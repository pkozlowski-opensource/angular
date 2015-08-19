import {
  AsyncTestCompleter,
  beforeEach,
  ddescribe,
  describe,
  expect,
  iit,
  inject,
  it,
  xit,
} from 'angular2/test_lib';

import {Component, Directive} from 'angular2/angular2';
import {reflector} from 'angular2/src/reflection/reflection';

export function main() {
  describe('es5 decorators', () => {
    it('should declare directive class', () => {
      var MyDirective = Directive({}).Class({constructor: function() { this.works = true; }});
      expect(new MyDirective().works).toEqual(true);
    });

    it('should declare Component class', () => {
      var MyComponent =
          Component({}).BaseView({}).BaseView({}).Class({constructor: function() { this.works = true; }});
      expect(new MyComponent().works).toEqual(true);
    });

    it('should create type in ES5', () => {
      function MyComponent(){};
      var as;
      (<any>MyComponent).annotations = as = Component({}).BaseView({});
      expect(reflector.annotations(MyComponent)).toEqual(as.annotations);
    });
  });
}
