/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgForOfContext} from '@angular/common';

import {defineComponent, QueryList} from '../../src/render3/index';
import {bind, container, elementEnd, elementProperty, elementStart, interpolation3, text, textBinding, load} from '../../src/render3/instructions';
import {query, queryRefresh} from '../../src/render3/query';
import {QUERY_READ_ELEMENT_REF} from '../../src/render3/di';
import {RenderFlags} from '../../src/render3/interfaces/definition';
import {NgForOf, NgIf} from './common_with_def';
import {ComponentFixture} from './render_util';

describe('@angular/common integration', () => {

  describe('NgForOf', () => {
    it('should update a loop', () => {
      class MyApp {
        items: string[] = ['first', 'second'];

        static ngComponentDef = defineComponent({
          type: MyApp,
          factory: () => new MyApp(),
          selectors: [['my-app']],
          // <ul>
          //   <li *ngFor="let item of items">{{item}}</li>
          // </ul>
          template: (rf: RenderFlags, myApp: MyApp) => {
            if (rf & RenderFlags.Create) {
              elementStart(0, 'ul');
              { container(1, liTemplate, undefined, ['ngForOf', '']); }
              elementEnd();
            }
            if (rf & RenderFlags.Update) {
              elementProperty(1, 'ngForOf', bind(myApp.items));
            }

            function liTemplate(rf1: RenderFlags, row: NgForOfContext<string>) {
              if (rf1 & RenderFlags.Create) {
                elementStart(0, 'li');
                { text(1); }
                elementEnd();
              }
              if (rf1 & RenderFlags.Update) {
                textBinding(1, bind(row.$implicit));
              }
            }
          },
          directives: () => [NgForOf]
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html).toEqual('<ul><li>first</li><li>second</li></ul>');

      // change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<ul><li>first</li><li>second</li></ul>');

      // remove the last item
      fixture.component.items.length = 1;
      fixture.update();
      expect(fixture.html).toEqual('<ul><li>first</li></ul>');

      // change an item
      fixture.component.items[0] = 'one';
      fixture.update();
      expect(fixture.html).toEqual('<ul><li>one</li></ul>');

      // add an item
      fixture.component.items.push('two');
      fixture.update();
      expect(fixture.html).toEqual('<ul><li>one</li><li>two</li></ul>');
    });

    it('should support ngForOf context variables', () => {

      class MyApp {
        items: string[] = ['first', 'second'];

        static ngComponentDef = defineComponent({
          type: MyApp,
          factory: () => new MyApp(),
          selectors: [['my-app']],
          // <ul>
          //   <li *ngFor="let item of items">{{index}} of {{count}}: {{item}}</li>
          // </ul>
          template: (rf: RenderFlags, myApp: MyApp) => {
            if (rf & RenderFlags.Create) {
              elementStart(0, 'ul');
              { container(1, liTemplate, undefined, ['ngForOf', '']); }
              elementEnd();
            }
            if (rf & RenderFlags.Update) {
              elementProperty(1, 'ngForOf', bind(myApp.items));
            }

            function liTemplate(rf1: RenderFlags, row: NgForOfContext<string>) {
              if (rf1 & RenderFlags.Create) {
                elementStart(0, 'li');
                { text(1); }
                elementEnd();
              }
              if (rf1 & RenderFlags.Update) {
                textBinding(
                    1, interpolation3('', row.index, ' of ', row.count, ': ', row.$implicit, ''));
              }
            }
          },
          directives: () => [NgForOf]
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html).toEqual('<ul><li>0 of 2: first</li><li>1 of 2: second</li></ul>');

      fixture.component.items.splice(1, 0, 'middle');
      fixture.update();
      expect(fixture.html)
          .toEqual('<ul><li>0 of 3: first</li><li>1 of 3: middle</li><li>2 of 3: second</li></ul>');
    });

  });

  describe('ngIf', () => {
    it('should support sibling ngIfs', () => {
      class MyApp {
        showing = true;
        valueOne = 'one';
        valueTwo = 'two';

        static ngComponentDef = defineComponent({
          type: MyApp,
          factory: () => new MyApp(),
          selectors: [['my-app']],
          /**
           * <div *ngIf="showing">{{ valueOne }}</div>
           * <div *ngIf="showing">{{ valueTwo }}</div>
           */
          template: (rf: RenderFlags, myApp: MyApp) => {
            if (rf & RenderFlags.Create) {
              container(0, templateOne, undefined, ['ngIf', '']);
              container(1, templateTwo, undefined, ['ngIf', '']);
            }
            if (rf & RenderFlags.Update) {
              elementProperty(0, 'ngIf', bind(myApp.showing));
              elementProperty(1, 'ngIf', bind(myApp.showing));
            }

            function templateOne(rf: RenderFlags, ctx: any) {
              if (rf & RenderFlags.Create) {
                elementStart(0, 'div');
                { text(1); }
                elementEnd();
              }
              if (rf & RenderFlags.Update) {
                textBinding(1, bind(myApp.valueOne));
              }
            }
            function templateTwo(rf: RenderFlags, ctx: any) {
              if (rf & RenderFlags.Create) {
                elementStart(0, 'div');
                { text(1); }
                elementEnd();
              }
              if (rf & RenderFlags.Update) {
                textBinding(1, bind(myApp.valueTwo));
              }
            }
          },
          directives: () => [NgIf]
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html).toEqual('<div>one</div><div>two</div>');

      fixture.component.valueOne = '$$one$$';
      fixture.component.valueTwo = '$$two$$';
      fixture.update();
      expect(fixture.html).toEqual('<div>$$one$$</div><div>$$two$$</div>');
    });

    it('should query elements inserted by ngIf', () => {

      class MyApp {
        showing = false;
        query: QueryList<any>;

        static ngComponentDef = defineComponent({
          type: MyApp,
          factory: () => new MyApp(),
          selectors: [['my-app']],
          template: (rf: RenderFlags, myApp: MyApp) => {
            if (rf & RenderFlags.Create) {
              query(0, ['foo'], true, QUERY_READ_ELEMENT_REF);
              container(1, ngIfTemplate, undefined, ['ngIf', '']);
            }
            if (rf & RenderFlags.Update) {
              let tmp: any;
              elementProperty(1, 'ngIf', bind(myApp.showing));
              queryRefresh(tmp = load<QueryList<any>>(0)) && (myApp.query = tmp as QueryList<any>);
            }

            function ngIfTemplate(rf: RenderFlags, ctx: any) {
              if (rf & RenderFlags.Create) {
                elementStart(0, 'div', null, ['foo', '']);
                elementEnd();
              }
            }
          },
          directives: () => [NgIf]
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html).toEqual('');
      expect(fixture.component.query.length).toBe(0);

      fixture.component.showing = true;
      fixture.update();
      expect(fixture.html).toEqual('<div></div>');
      expect(fixture.component.query.length).toBe(1);

      fixture.component.showing = false;
      fixture.update();
      expect(fixture.html).toEqual('');
      expect(fixture.component.query.length).toBe(0);
    });

  });
});
