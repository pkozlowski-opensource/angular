/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import chalk from 'chalk';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Builder, WebDriver} from 'selenium-webdriver4';

import {Browser, getUniqueId} from '../browser';

import {IpcServer} from './ipc';

const defaultCapabilities = {
  recordVideo: false,
  recordScreenshots: false,
  idleTimeout: 90,
  // These represent the maximum values supported by Saucelabs.
  // See: https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options
  commandTimeout: 600,
  maxDuration: 10800,
  extendedDebugging: true,
};

interface RemoteBrowser {
  id: string;
  state: 'claimed'|'free'|'launching';
  driver: WebDriver|null;
}

interface BrowserTest {
  testId: number;
  pageUrl: string;
  requestedBrowserId: string;
}

/**
 * The SaucelabsDaemon daemon service class. This class handles the logic of connecting
 * to the Saucelabs tunnel and provisioning browsers for tests. Provisioned browsers
 * are re-used for subsequent tests. Their states are tracked so that new test
 * requests are assigned to browsers that are currently `free` or `launching`.
 */
export class SaucelabsDaemon {
  /**
   * Map of browsers and their pending tests. If a browser is acquired on the
   * remote selenium server, the browser is not immediately ready. If the browser
   * becomes active, the pending tests will be started.
   */
  private _pendingTests = new Map<RemoteBrowser, BrowserTest>();

  /** List of active browsers that are managed by the daemon. */
  private _activeBrowsers = new Set<RemoteBrowser>();

  /** Map that contains test ids with their claimed browser. */
  private _runningTests = new Map<number, RemoteBrowser>();

  /** Server used for communication with the Karma launcher. */
  private _server = new IpcServer(this);

  /** Base selenium capabilities that will be added to each browser. */
  private _baseCapabilities = {...defaultCapabilities, ...this._userCapabilities};

  /** Id of the keep alive interval that ensures no remote browsers time out. */
  private _keepAliveIntervalId: NodeJS.Timeout|null = null;

  /* Promise  indicating whether we the tunnel is active, or if we are still connecting. */
  private _connection: Promise<void>|undefined = undefined;

  constructor(
      private _username: string,
      private _accessKey: string,
      private _buildName: string,
      private _browsers: Browser[],
      private _sauceConnect: string,
      private _userCapabilities: object = {},
  ) {
    // Starts the keep alive loop for all active browsers, running every 15 seconds.
    this._keepAliveIntervalId = setInterval(() => this._keepAliveBrowsers(), 15_000);
  }

  /**
   * Connects the daemon to Saucelabs.
   * This is typically done when the first test is started so that no connection is made
   * if all tests are cache hits.
   */
  async connectTunnel() {
    if (!this._connection) {
      this._connection = this._connect();
    }
    return this._connection;
  }

  /**
   * Quits all active browsers.
   */
  async quitAllBrowsers() {
    let quitBrowsers: Promise<void>[] = [];
    this._activeBrowsers.forEach(b => {
      if (b.driver) {
        quitBrowsers.push(b.driver.quit());
      }
    });
    await Promise.all(quitBrowsers);
    this._activeBrowsers.clear();
    this._runningTests.clear();
    this._pendingTests.clear();
  }

  /**
   * Shutdown the daemon.
   *
   * Awaits the shutdown of browsers.
   */
  async shutdown() {
    await this.quitAllBrowsers();
    if (this._keepAliveIntervalId !== null) {
      clearInterval(this._keepAliveIntervalId);
    }
  }

  /**
   * End a browser test if it is running.
   */
  endTest(testId: number) {
    if (!this._runningTests.has(testId)) {
      return;
    }

    const browser = this._runningTests.get(testId)!;
    browser.state = 'free';
    this._runningTests.delete(testId);
  }

  /**
   * Start a test on a remote browser.
   *
   * If the daemon has not yet initiated the saucelabs tunnel creation and browser launching then
   * this initiates that process and awaits until it succeeds or fails.
   *
   * If the daemon has already initiated the saucelabs tunnel creation and browser launching
   * but it is not yet complete then this blocks until that succeeds or fails.
   *
   * If all matching browsers are occupied with other tests then test is not run. Promise returns
   * false.
   *
   * If there is a matching browser that are still launching then the test is scheduled to run
   * on the browser when it is ready. Promise returns true.
   *
   * If there is a matching browser that is available the test it started. Promise returns true.
   */
  async startTest(test: BrowserTest): Promise<boolean> {
    await this.connectTunnel();

    const browsers = this._findMatchingBrowsers(test.requestedBrowserId);
    if (!browsers.length) {
      return false;
    }

    // Find the first available browser and start the test.
    for (const browser of browsers) {
      // If the browser is claimed, continue searching.
      if (browser.state === 'claimed') {
        continue;
      }

      // If the browser is launching, check if it can be pre-claimed so that
      // the test starts once the browser is ready. If it's already claimed,
      // continue searching.
      if (browser.state === 'launching') {
        if (this._pendingTests.has(browser)) {
          continue;
        } else {
          this._pendingTests.set(browser, test);
          return true;
        }
      }

      // We're not interested in awaiting on _startBrowserTest since we only need to report back to
      // the caller that the browser test was initiated. Failures in _startBrowserTest() are
      // silently ignored in the daemon. The karma test itself should fail or timeout if there are
      // issues starting the browser test.
      this._startBrowserTest(browser, test);
      return true;
    }

    return false;
  }

  /**
   * @internal
   * Connects the daemon to Saucelabs.
   * This is typically done when the first test is started so that no connection is made
   * if all tests are cache hits.
   **/
  private async _connect() {
    await this._openSauceConnectTunnel();
    await this._launchBrowsers();
  }

  /**
   * @internal
   * Establishes the Saucelabs connect tunnel.
   **/
  private async _openSauceConnectTunnel() {
    console.debug('Starting sauce connect tunnel...');

    const tmpFolder = await fs.mkdtemp('saucelabs-daemon-');

    await new Promise<void>((resolve, reject) => {
      // First we need to start the sauce connect tunnel
      const sauceConnectArgs = [
        '--readyfile',
        `${tmpFolder}/readyfile`,
        '--pidfile',
        `${tmpFolder}/pidfile`,
        '--tunnel-identifier',
        (this._userCapabilities as any).tunnelIdentifier || path.basename(tmpFolder),
      ];
      const sc = spawn(this._sauceConnect, sauceConnectArgs);

      sc.stdout!.on('data', (data) => {
        if (data.includes('Sauce Connect is up, you may start your tests.')) {
          resolve();
        }
      });

      sc.on('close', (code) => {
        reject(new Error(`sauce connect closed all stdio with code ${code}`));
      });

      sc.on('exit', (code) => {
        reject(new Error(`sauce connect exited with code ${code}`));
      });
    });

    console.debug('Starting sauce connect tunnel established');
  }

  /**
   * @internal
   * Launches all browsers. If there are pending tests waiting for a particular browser to launch
   * before they can start, those tests are started once the browser is launched.
   **/
  private async _launchBrowsers() {
    console.debug('Launching browsers...');

    // Once the tunnel is established we can launch browsers
    await Promise.all(
        this._browsers.map(async (browser, id) => {
          const browserId = getUniqueId(browser);
          const launched: RemoteBrowser = {state: 'launching', driver: null, id: browserId};
          const browserDescription = `${this._buildName} - ${browser.browserName} - #${id + 1}`;

          const capabilities: any = {
            'browserName': browser.browserName,
            'sauce:options': {...this._baseCapabilities, ...browser},
          };

          // Set `sauce:options` to provide a build name for the remote browser instances.
          // This helps with debugging. Also ensures the W3C protocol is used.
          // See. https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options
          capabilities['sauce:options']['name'] = browserDescription;
          capabilities['sauce:options']['build'] = browserDescription;

          console.debug(
              `Capabilities for ${browser.browserName}:`, JSON.stringify(capabilities, null, 2));
          console.debug(`  > Browser-ID: `, browserId);
          console.debug(`  > Browser-Description: `, browserDescription);

          // Keep track of the launched browser. We do this before it even completed the
          // launch as we can then handle scheduled tests when the browser is still launching.
          this._activeBrowsers.add(launched);

          // See the following link for public API of the selenium server.
          // https://wiki.saucelabs.com/display/DOCS/Instant+Selenium+Node.js+Tests
          const driver = await new Builder()
                             .withCapabilities(capabilities)
                             .usingServer(
                                 `http://${this._username}:${
                                     this._accessKey}@ondemand.saucelabs.com:80/wd/hub`,
                                 )
                             .build();

          // Only wait 30 seconds to load a test page.
          await driver.manage().setTimeouts({pageLoad: 30000});

          const sessionId = (await driver.getSession()).getId();
          console.info(
              chalk.yellow(
                  `Started browser ${browser.browserName} on Saucelabs: ` +
                      `https://saucelabs.com/tests/${sessionId}`,
                  ),
          );

          // Mark the browser as available after launch completion.
          launched.state = 'free';
          launched.driver = driver;

          // If a test has been scheduled before the browser completed launching, run
          // it now given that the browser is ready now.
          if (this._pendingTests.has(launched)) {
            // We're not interested in awaiting on _startBrowserTest since that would delay starting
            // additional browsers. Failures in _startBrowserTest() are silently ignored in the
            // daemon. The karma test itself should fail or timeout if there are issues starting the
            // browser test.
            this._startBrowserTest(launched, this._pendingTests.get(launched)!);
          }
        }),
    );
  }

  /**
   * @internal
   * Starts a browser test on a browser.
   * This sets the browser's state to "claimed" and navigates the browser to the test URL.
   **/
  private _startBrowserTest(browser: RemoteBrowser, test: BrowserTest) {
    this._runningTests.set(test.testId, browser);
    browser.state = 'claimed';

    console.debug(`Opening test url for #${test.testId}: ${test.pageUrl}`);
    browser.driver!.get(test.pageUrl)
        .then(() => {
          browser.driver!.getTitle()
              .then((pageTitle) => {
                console.debug(`Test page loaded for #${test.testId}: "${pageTitle}".`);
              })
              .catch((e) => {
                console.error('Could not start browser test with id', test.testId, test.pageUrl);
              });
        })
        .catch((e) => {
          console.error('Could not start browser test with id', test.testId, test.pageUrl);
        });
  }

  /**
   * @internal
   * Given a browserId, returns a list of matching browsers from the list of active browsers.
   **/
  private _findMatchingBrowsers(browserId: string): RemoteBrowser[] {
    const browsers: RemoteBrowser[] = [];
    this._activeBrowsers.forEach(b => {
      if (b.id === browserId) {
        browsers.push(b);
      }
    });
    return browsers;
  }

  /**
   * @internal
   * Implements a heartbeat for Saucelabs browsers as they could end up not receiving any
   * commands when the daemon is unused (i.e. Bazel takes a while to start tests).
   * https://saucelabs.com/blog/selenium-tips-how-to-coordinate-multiple-browsers-in-sauce-ondemand.
   **/
  private async _keepAliveBrowsers() {
    const pendingCommands: Promise<string>[] = [];
    this._activeBrowsers.forEach(b => {
      if (b.driver !== null) {
        pendingCommands.push(b.driver.getTitle() as Promise<string>);
      }
    });
    await Promise.all(pendingCommands);
    console.debug(`${Date().toLocaleString()}: Refreshed ${pendingCommands.length} browsers.`);
  }
}
