import {
  describe,
  ddescribe,
  it,
  iit,
  xit,
  xdescribe,
  expect,
  beforeEach,
  el,
  IS_DARTIUM
} from 'angular2/test_lib';

import {ProtoViewBuilder} from 'angular2/src/render/dom/view/proto_view_builder';
import {ASTWithSource, AST} from 'angular2/change_detection';
import {PropertyBindingType, ViewType} from 'angular2/src/render/api';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {TestCustomElement} from './test_custom_element';

export function main() {
  function emptyExpr() { return new ASTWithSource(new AST(), 'empty', 'empty'); }

  describe('ProtoViewBuilder', () => {
    var builder;
    beforeEach(
        () => { builder = new ProtoViewBuilder(DOM.createTemplate(''), ViewType.EMBEDDED); });

    if (!IS_DARTIUM) {
      describe('verification of properties', () => {

        it('should throw for unknown properties', () => {
          builder.bindElement(el('<div/>')).bindProperty('unknownProperty', emptyExpr());
          expect(() => builder.build())
              .toThrowError(
                  `Can't bind to 'unknownProperty' since it isn't a known property of the '<div>' element and there are no matching directives with a corresponding property`);
        });

        it('should allow unknown properties if a directive uses it', () => {
          var binder = builder.bindElement(el('<div/>'));
          binder.bindDirective(0).bindProperty('someDirProperty', emptyExpr(), 'directiveProperty');
          binder.bindProperty('directiveProperty', emptyExpr());
          expect(() => builder.build()).not.toThrow();
        });

        it('should throw for unknown properties on custom-like elements', () => {
          var binder = builder.bindElement(el('<some-custom/>'));
          binder.bindProperty('unknownProperty', emptyExpr());
          expect(() => builder.build())
              .toThrowError(
                  `Can't bind to 'unknownProperty' since it isn't a known property of the '<some-custom>' element and there are no matching directives with a corresponding property`);
        });

        if (DOM.supportsCustomElements()) {
          DOM.registerElement('some-custom', TestCustomElement);

          it('should allow known properties of custom elements', () => {
            var binder = builder.bindElement(el('<some-custom/>'));
            binder.bindProperty('knownProperty', emptyExpr());
            binder.bindProperty('title', emptyExpr());
            expect(() => builder.build()).not.toThrow();
          });

          it('should throw for unknown properties on custom elements', () => {
            var binder = builder.bindElement(el('<some-custom/>'));
            binder.bindProperty('unknownProperty', emptyExpr());
            expect(() => builder.build())
                .toThrowError(
                    `Can't bind to 'unknownProperty' since it isn't a known property of the '<some-custom>' element and there are no matching directives with a corresponding property`);
          });
        }

        it('should throw for unknown properties on custom elements if there is an ng component', () => {
          var binder = builder.bindElement(el('<some-custom/>'));
          binder.bindProperty('unknownProperty', emptyExpr());
          binder.setComponentId('someComponent');
          expect(() => builder.build())
              .toThrowError(
                  `Can't bind to 'unknownProperty' since it isn't a known property of the '<some-custom>' element and there are no matching directives with a corresponding property`);
        });

      });
    } else {
      describe('verification of properties', () => {

        // TODO(tbosch): This is just a temporary test that makes sure that the dart server and
        // dart browser is in sync. Change this to "not contains notifyBinding"
        // when https://github.com/angular/angular/issues/3019 is solved.
        it('should throw for unknown properties', () => {
          builder.bindElement(el('<div/>')).bindProperty('unknownProperty', emptyExpr());
          expect(() => builder.build()).not.toThrow();
        });

      });
    }

    describe('property normalization', () => {
      it('should normalize "innerHtml" to "innerHTML"', () => {
        builder.bindElement(el('<div/>')).bindProperty('innerHtml', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].property).toEqual('innerHTML');
      });

      it('should normalize "tabindex" to "tabIndex"', () => {
        builder.bindElement(el('<div/>')).bindProperty('tabindex', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].property).toEqual('tabIndex');
      });

      it('should normalize "readonly" to "readOnly"', () => {
        builder.bindElement(el('<input/>')).bindProperty('readonly', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].property).toEqual('readOnly');
      });

    });

    describe('property binding types', () => {
      it('should detect property names', () => {
        builder.bindElement(el('<div/>')).bindProperty('tabindex', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].type).toEqual(PropertyBindingType.PROPERTY);
      });

      it('should detect attribute names', () => {
        builder.bindElement(el('<div/>')).bindProperty('attr.someName', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].type)
            .toEqual(PropertyBindingType.ATTRIBUTE);
      });

      it('should detect class names', () => {
        builder.bindElement(el('<div/>')).bindProperty('class.someName', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].type).toEqual(PropertyBindingType.CLASS);
      });

      it('should detect style names', () => {
        builder.bindElement(el('<div/>')).bindProperty('style.someName', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].type).toEqual(PropertyBindingType.STYLE);
      });

      it('should detect style units', () => {
        builder.bindElement(el('<div/>')).bindProperty('style.someName.someUnit', emptyExpr());
        var pv = builder.build();
        expect(pv.elementBinders[0].propertyBindings[0].unit).toEqual('someUnit');
      });
    });


  });
}
