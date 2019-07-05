/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, ContentChild, ContentChildren, Directive, ElementRef, QueryList, TemplateRef, ViewChild, ViewChildren, ViewContainerRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {expect} from '@angular/platform-browser/testing/src/matchers';
import {onlyInIvy} from '@angular/private/testing';

describe('tquery logic', () => {

  describe('basic functionality', () => {

    it('should query single element from view with the default read option', () => {
      @Component({selector: 'test-cmpt', template: '<div #foo></div>'})
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
    });

    it('should query single element by directive with the default read option', () => {
      @Directive({selector: '[directive]'})
      class TestDirective {
      }

      @Component({selector: 'test-cmpt', template: '<div directive></div>'})
      class TestCmpt {
        @ViewChild(TestDirective, {static: false}) foo !: TestDirective;
      }

      TestBed.configureTestingModule({declarations: [TestDirective, TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(TestDirective);
    });

    it('should query multiple elements from view with default read option', () => {
      @Component({selector: 'test-cmpt', template: '<div #foo></div><div #foo></div>'})
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foos).toBeAnInstanceOf(QueryList);
      expect(fixture.componentInstance.foos.length).toBe(2);
    });

    it('should support multiple view queries with the default read option', () => {
      @Component({selector: 'test-cmpt', template: '<div #foo></div><div #foo #bar></div>'})
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo !: ElementRef<any>;
        @ViewChildren('bar') bars !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
      expect(fixture.componentInstance.bars).toBeAnInstanceOf(QueryList);
      expect(fixture.componentInstance.bars.length).toBe(1);
    });

    it('should not re-create / re-assign QueryList instance', () => {
      @Component({selector: 'test-cmpt', template: '<div #foo></div><div #foo></div>'})
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const queryList = fixture.componentInstance.foos;
      expect(queryList).toBeAnInstanceOf(QueryList);
      expect(queryList.length).toBe(2);

      fixture.detectChanges();
      const queryList2 = fixture.componentInstance.foos;
      expect(queryList2).toBeAnInstanceOf(QueryList);
      expect(queryList2.length).toBe(2);
      expect(queryList2).toBe(queryList);
    });

    it('should support content queries', () => {
      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      @Component({selector: 'test-cmpt', template: '<div content-query><div #foo></div></div>'})
      class TestCmpt {
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foo).toBeAnInstanceOf(ElementRef);
    });

    it('should support mix of content and view queries in the same view', () => {
      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      @Component({selector: 'test-cmpt', template: '<div content-query><div #foo></div></div>'})
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foo).toBeAnInstanceOf(ElementRef);
      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
    });

    it('should query only its own content', () => {
      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      @Component({selector: 'test-cmpt', template: '<div content-query></div><div #foo></div>'})
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foo).toBeUndefined();
      expect(fixture.componentInstance.foos).toBeAnInstanceOf(QueryList);
      expect(fixture.componentInstance.foos.length).toBe(1);
    });

    it('should query only its own content - descendant child', () => {
      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <div content-query>
            <div>
              <div #foo></div>
            </div>
          </div>
          <span #foo></span>`
      })
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foo).toBeAnInstanceOf(ElementRef);
      expect(dirInstance.foo.nativeElement.tagName).toBe('DIV');
      expect(fixture.componentInstance.foos).toBeAnInstanceOf(QueryList);
      expect(fixture.componentInstance.foos.length).toBe(2);
    });

    it('should query for TemplateRef', () => {
      @Component({selector: 'test-cmpt', template: '<ng-template></ng-template>'})
      class TestCmpt {
        @ViewChild(TemplateRef, {static: false}) foo !: TemplateRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(TemplateRef);
    });

  });

  describe('views - declaration point equal to the insertion point', () => {
    it('should report results from embedded views', () => {
      @Component({
        selector: 'test-cmpt',
        template: '<ng-template [ngIf]="true"><div #foo></div></ng-template>'
      })
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
    });

    it('should report results from embedded views in the correct order', () => {
      @Component({
        selector: 'test-cmpt',
        template:
            '<a #foo></a><ng-template [ngIf]="true"><div #foo></div></ng-template><b #foo></b>'
      })
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foos.length).toBe(3);
      const matches = fixture.componentInstance.foos.toArray();
      expect(matches[0].nativeElement.tagName).toBe('A');
      expect(matches[1].nativeElement.tagName).toBe('DIV');
      expect(matches[2].nativeElement.tagName).toBe('B');
    });

    it('should not report results from embedded views content query is not active', () => {
      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <a content-query></a>
          <ng-template [ngIf]="true">
            <div #foo></div>
          </ng-template>
          <b #foo></b>`
      })
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo !: ElementRef<any>;
      }

      TestBed.configureTestingModule({declarations: [ContentQueryDir, TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
      expect(dirInstance.foo).toBeUndefined();
    });

    it('should add / remove results from embedded views based on view insertion / removal', () => {
      @Component({
        selector: 'test-cmpt',
        template: `
          <a #foo></a>
          <ng-template [ngIf]="show">
            <div #foo></div>
          </ng-template>
          <b #foo></b>`
      })
      class TestCmpt {
        show = true;
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foos.length).toBe(3);

      fixture.componentInstance.show = false;
      fixture.detectChanges();
      expect(fixture.componentInstance.foos.length).toBe(2);

      fixture.componentInstance.show = true;
      fixture.detectChanges(false);
      expect(fixture.componentInstance.foos.length).toBe(3);
    });

    it('should not dirty query list if embedded view has no matches', () => {
      @Component({
        selector: 'test-cmpt',
        template: `
          <a #foo></a>
          <ng-template [ngIf]="show">
            <div></div>
          </ng-template>
          <ng-template></ng-template>
          <b #foo></b>`
      })
      class TestCmpt {
        show = true;
        _foos: QueryList<ElementRef<any>>|null = null;

        @ViewChildren('foo')
        set foos(newFoos: QueryList<ElementRef<any>>|null) {
          if (this._foos === null) {
            this._foos = newFoos;
          } else {
            fail('Trying to re-assign QueryList instance even if it was not dirty');
          }
        }

        get foos(): QueryList<ElementRef<any>>|null { return this._foos; }
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foos !.length).toBe(2);

      fixture.componentInstance.show = false;
      fixture.detectChanges();
      expect(fixture.componentInstance.foos !.length).toBe(2);

      fixture.componentInstance.show = true;
      debugger;
      fixture.detectChanges(false);
      expect(fixture.componentInstance.foos !.length).toBe(2);
    });
  });

  describe('descend', () => {

    it('should respect explicit descend flag', () => {

      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChildren('foo', {descendants: false}) foos !: QueryList<ElementRef<any>>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <div #foo content-query>
            <div #foo>
              <span #foo></span>
            </div>
          </div>
        `
      })
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();


      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foos.length).toBe(1);
      expect(fixture.componentInstance.foos.length).toBe(3);
    });

    it('should respect descendants false at the root of a view', () => {

      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChildren('foo', {descendants: false}) foos !: QueryList<ElementRef<any>>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <div content-query>
            <ng-template [ngIf]="true">
              <div #foo></div>
            </ng-template>
          </div>
        `
      })
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();


      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foos.length).toBe(1);
      expect(fixture.componentInstance.foos.length).toBe(1);
    });

    it('should respect descendants false in the embedded view', () => {

      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChildren('foo', {descendants: false}) foos !: QueryList<ElementRef<any>>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <div content-query>
            <ng-template [ngIf]="true">
              <span>
                <div #foo></div>
              </span>
            </ng-template>
          </div>
        `
      })
      class TestCmpt {
        @ViewChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();


      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foos.length).toBe(0);
      expect(fixture.componentInstance.foos.length).toBe(1);
    });

  });

  describe('read', () => {

    it('should read specified token from a node injector', () => {
      @Directive({selector: '[test-dir]'})
      class TestDir {
      }

      @Component({selector: 'test-cmpt', template: '<div #foo test-dir></div>'})
      class TestCmpt {
        @ViewChild('foo', {static: false, read: TestDir}) foo !: TestDir;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, TestDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.foo).toBeAnInstanceOf(TestDir);
    });

    it('should read special tokens from a node injector', () => {
      @Component(
          {selector: 'test-cmpt', template: '<div #foo></div><ng-template #bar></ng-template>'})
      class TestCmpt {
        @ViewChild('foo', {static: false, read: ElementRef}) elRef !: ElementRef;
        @ViewChild('foo', {static: false, read: ViewContainerRef}) vcRef !: ViewContainerRef;
        @ViewChild('bar', {static: false, read: TemplateRef}) tplRef !: TemplateRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.elRef).toBeAnInstanceOf(ElementRef);
      expect(fixture.componentInstance.vcRef).toBeAnInstanceOf(ViewContainerRef);
      expect(fixture.componentInstance.tplRef).toBeAnInstanceOf(TemplateRef);
    });

    it('should query for a special token and read another special token', () => {
      @Component({selector: 'test-cmpt', template: '<ng-template></ng-template>'})
      class TestCmpt {
        @ViewChild(TemplateRef, {static: false, read: ViewContainerRef}) vcRef !: ViewContainerRef;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.vcRef).toBeAnInstanceOf(ViewContainerRef);
    });

    it('should not return results where node matches but a token cant be read', () => {
      class DoesntExist {}

      @Component({selector: 'test-cmpt', template: '<ng-template></ng-template>'})
      class TestCmpt {
        @ViewChildren(TemplateRef, {read: DoesntExist}) list !: QueryList<DoesntExist>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges();

      expect(fixture.componentInstance.list.length).toBe(0);
    });

  });

  describe('static queries', () => {

    it('should support static view child', () => {
      @Component({selector: 'test-cmpt', template: '<div #foo></div>'})
      class TestCmpt {
        @ViewChild('foo', {static: true}) foo !: ElementRef;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      expect(fixture.componentInstance.foo).toBeAnInstanceOf(ElementRef);
    });

    it('should support static content child', () => {
      @Component({selector: 'test-cmpt', template: '<div content-query><div #foo></div></div>'})
      class TestCmpt {
      }

      @Directive({selector: '[content-query]'})
      class ContentQueryDir {
        @ContentChild('foo', {static: true}) foo !: ElementRef<any>;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryDir]});
      const fixture = TestBed.createComponent(TestCmpt);
      const dirInstance =
          fixture.debugElement.query(By.directive(ContentQueryDir)).injector.get(ContentQueryDir);
      expect(dirInstance.foo).toBeAnInstanceOf(ElementRef);
    });

  });

  describe('perf debugging', () => {

    it('should not allocate things for a query that does not match but crosses ng-template', () => {
      @Component({selector: 'test-cmpt', template: '<ng-template [ngIf]="true"></ng-template>'})
      class TestCmpt {
        @ViewChild('foo', {static: false}) foo: ElementRef|undefined;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges(false);
      expect(fixture.componentInstance.foo).toBeUndefined();
    });

    it('should propagate proper query index with nested embedded views', () => {

      @Directive({selector: 'content-query-host'})
      class ContentQueryHost {
        @ContentChildren('foo') foos !: QueryList<ElementRef<any>>;
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <ng-template [ngIf]="show">
            <content-query-host>
              <ng-template [ngIf]="true"><div #foo></div></ng-template>
            </content-query-host>
          </ng-template>
      `
      })
      class TestCmpt {
        show = false;
      }

      TestBed.configureTestingModule({declarations: [TestCmpt, ContentQueryHost]});
      const fixture = TestBed.createComponent(TestCmpt);
      fixture.detectChanges(false);

      fixture.componentInstance.show = true;
      fixture.detectChanges(false);
      expect(fixture.debugElement.query(By.directive(ContentQueryHost))
                 .injector.get(ContentQueryHost)
                 .foos.length)
          .toBe(1);

      fixture.componentInstance.show = false;
      fixture.detectChanges(false);

      fixture.componentInstance.show = true;
      fixture.detectChanges(false);
      expect(fixture.debugElement.query(By.directive(ContentQueryHost))
                 .injector.get(ContentQueryHost)
                 .foos.length)
          .toBe(1);
    });

  });
});

// TODO:
// - view boundaries (different declaration and insertion point)
// - make sure that inherited view queries are not refreshed as part of the embedded view refresh
// - view container ref created on a non-template-ref element ??? - it is declaration that matters!
