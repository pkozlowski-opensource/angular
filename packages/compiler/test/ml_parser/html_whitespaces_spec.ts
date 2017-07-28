/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as html from '../../src/ml_parser/ast';
import {HtmlParser} from '../../src/ml_parser/html_parser';
import {PRESERVE_WS_ATTR_NAME, WhitespaceVisitor, removeWhitespaces} from '../../src/ml_parser/html_whitespaces';
import {ParseLocation, ParseSourceFile, ParseSourceSpan} from '../../src/parse_util';

import {humanizeDom} from './ast_spec_utils';

function visitText(value: string): html.Text|null {
  const visitor = new WhitespaceVisitor();
  const parseFile = new ParseSourceFile(value, 'file://test');
  const locStart = new ParseLocation(parseFile, 0, 0, 0);
  const locEnd = new ParseLocation(parseFile, 0, 0, value.length);

  return visitor.visitText(new html.Text(value, new ParseSourceSpan(locStart, locEnd)), null);
}

export function main() {
  describe('whitespaces', () => {

    describe('WhitespaceVisitor', () => {

      it('should return null for blank text nodes', () => {
        expect(visitText(' ')).toBeNull();
        expect(visitText('\n')).toBeNull();
        expect(visitText('\t')).toBeNull();
        expect(visitText('    \t    \n ')).toBeNull();
      });


      it('should replace multiple whitespaces with one space', () => {
        expect(visitText('\nfoo') !.value).toEqual(' foo');
        expect(visitText('\tfoo') !.value).toEqual(' foo');
        expect(visitText('   \n foo  \t ') !.value).toEqual(' foo ');
      });

      it('should replace &ngsp; with a space',
         () => { expect(visitText('\uE500') !.value).toEqual(' '); });

      it('should treat &ngsp; as a space when collapsing whitespaces',
         () => { expect(visitText('  \uE500\n') !.value).toEqual(' '); });
    });

    describe('removeWhitespaces', () => {

      function parseAndRemoveWS(template: string): any[] {
        return humanizeDom(removeWhitespaces(new HtmlParser().parse(template, 'TestComp')));
      }

      it('should remove whitespaces (space, tab, new line) between elements', () => {
        expect(parseAndRemoveWS('<br>  <br>\t<br>\n<br>')).toEqual([
          [html.Element, 'br', 0],
          [html.Element, 'br', 0],
          [html.Element, 'br', 0],
          [html.Element, 'br', 0],
        ]);
      });

      it('should remove whitespaces from child text nodes', () => {
        expect(parseAndRemoveWS('<div><span> </span></div>')).toEqual([
          [html.Element, 'div', 0],
          [html.Element, 'span', 1],
        ]);
      });

      it('should remove whitespaces from the beginning and end of a template', () => {
        expect(parseAndRemoveWS(` <br>\t`)).toEqual([
          [html.Element, 'br', 0],
        ]);
      });

      it('should convert &ngsp; to a space and preserve it', () => {
        expect(parseAndRemoveWS('<div><span>foo</span>&ngsp;<span>bar</span></div>')).toEqual([
          [html.Element, 'div', 0],
          [html.Element, 'span', 1],
          [html.Text, 'foo', 2],
          [html.Text, ' ', 1],
          [html.Element, 'span', 1],
          [html.Text, 'bar', 2],
        ]);
      });

      it('should preserve whitespaces in non-blank text nodes', () => {
        expect(parseAndRemoveWS(`<div>\tfoo </div>`)).toEqual([
          [html.Element, 'div', 0],
          [html.Text, ' foo ', 1],
        ]);
      });

      it('should preserve whitespaces between interpolations', () => {
        expect(parseAndRemoveWS(`{{fooExp}}\n{{barExp}}`)).toEqual([
          [html.Text, '{{fooExp}} {{barExp}}', 0],
        ]);
      });

      it('should preserve whitespaces around interpolations', () => {
        expect(parseAndRemoveWS(`\t{{exp}}\n`)).toEqual([
          [html.Text, ' {{exp}} ', 0],
        ]);
      });

      it('should preserve whitespaces inside <pre> elements', () => {
        expect(parseAndRemoveWS(`<pre><strong>foo</strong>\n<strong>bar</strong></pre>`)).toEqual([
          [html.Element, 'pre', 0],
          [html.Element, 'strong', 1],
          [html.Text, 'foo', 2],
          [html.Text, '\n', 1],
          [html.Element, 'strong', 1],
          [html.Text, 'bar', 2],
        ]);
      });

      it('should ship whitespace trimming in <textarea>', () => {
        expect(parseAndRemoveWS(`<textarea>foo\nbar</textarea>`)).toEqual([
          [html.Element, 'textarea', 0],
          [html.Text, 'foo\nbar', 1],
        ]);
      });

      it(`should preserve whitespaces inside elements annotated with ${PRESERVE_WS_ATTR_NAME}`,
         () => {
           expect(parseAndRemoveWS(`<div ${PRESERVE_WS_ATTR_NAME}><img> <img></div>`)).toEqual([
             [html.Element, 'div', 0],
             [html.Element, 'img', 1],
             [html.Text, ' ', 1],
             [html.Element, 'img', 1],
           ]);
         });
    });

  });
}
