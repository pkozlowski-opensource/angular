/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import {ApplicationRef, ChangeDetectorRef, Component, Directive, EmbeddedViewRef, TemplateRef, ViewChild, ViewContainerRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {expect} from '@angular/platform-browser/testing/src/matchers';

describe('change detection', () => {

  describe('embedded views', () => {

    @Directive({selector: '[viewManipulation]', exportAs: 'vm'})
    class ViewManipulation {
      constructor(
          private _tplRef: TemplateRef<{}>, private _vcRef: ViewContainerRef,
          private _appRef: ApplicationRef) {}

      insertIntoVcRef() { this._vcRef.createEmbeddedView(this._tplRef); }

      insertIntoAppRef(): EmbeddedViewRef<{}> {
        const viewRef = this._tplRef.createEmbeddedView({});
        this._appRef.attachView(viewRef);
        return viewRef;
      }
    }

    @Component({
      selector: 'test-cmp',
      template: `
        <ng-template #vm="vm" viewManipulation>{{'change-detected'}}</ng-template>
      `
    })
    class TestCmpt {
    }

    beforeEach(() => {
      TestBed.configureTestingModule({declarations: [TestCmpt, ViewManipulation]});
    });

    it('should detect changes for embedded views inserted through ViewContainerRef', () => {
      const fixture = TestBed.createComponent(TestCmpt);
      const vm = fixture.debugElement.childNodes[0].references['vm'] as ViewManipulation;

      vm.insertIntoVcRef();
      fixture.detectChanges();

      expect(fixture.nativeElement).toHaveText('change-detected');
    });

    it('should detect changes for embedded views attached to ApplicationRef', () => {
      const fixture = TestBed.createComponent(TestCmpt);
      const vm = fixture.debugElement.childNodes[0].references['vm'] as ViewManipulation;

      const viewRef = vm.insertIntoAppRef();

      // A newly created view was attached to the CD tree via ApplicationRef so should be also
      // change detected when ticking root component
      fixture.detectChanges();

      expect(viewRef.rootNodes[0]).toHaveText('change-detected');
    });

  });

  describe('detached embedded views', () => {

    it('should change-detect projected view when the declaration place is change-detected', () => {
      @Component(
          {selector: 'view-inserting', template: `<ng-template #insertionPoint></ng-template>`})
      class ViewInsertingCmp {
        @ViewChild('insertionPoint', {read: ViewContainerRef})
        _vcRef !: ViewContainerRef;

        constructor(private _cdRef: ChangeDetectorRef) {}

        insert(tpl: TemplateRef<{}>): void { this._vcRef.createEmbeddedView(tpl); }

        detachFromCDTree() { this._cdRef.detach(); }
      }

      @Component({
        selector: 'test-cmpt',
        template: `
          <ng-template #declaredTpl>{{counter}}</ng-template>    
          <view-inserting #vi></view-inserting>      
        `
      })
      class TestCmpt {
        counter = 0;
      }


      TestBed.configureTestingModule({declarations: [ViewInsertingCmp, TestCmpt]});

      const fixture = TestBed.createComponent(TestCmpt);
      const tpl = fixture.debugElement.childNodes[0].references['declaredTpl'] as TemplateRef<{}>;
      const viCmpt = fixture.debugElement.childNodes[1].references['vi'] as ViewInsertingCmp;

      // call initial detect changes so view query in the ViewInsertingCmp gets resolved
      fixture.detectChanges();
      expect(fixture.nativeElement).toHaveText('');

      // call insert an embedded view (declaration and insertion points are different) and change
      // detect the entire tree (both declaration and insertion point are dirty checked)
      viCmpt.insert(tpl);
      fixture.detectChanges();
      expect(fixture.nativeElement).toHaveText('0');

      // now detach the insertion point from the CD tree but notice that the inserted view is still
      // change-detected (since its declaration point is change-detected)
      fixture.componentInstance.counter = 1;
      viCmpt.detachFromCDTree();
      fixture.detectChanges();
      expect(fixture.nativeElement).toHaveText('1');
    });

  });

});