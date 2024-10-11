// tslint:disable

import {Input, Directive} from '@angular/core';

@Directive()
class Base {
  // should not be migrated.
  @Input() bla = true;
}

@Directive({
  inputs: [{name: 'bla', alias: 'matDerivedBla'}],
  standalone: false,
})
class Derived extends Base {}
