// tslint:disable

import {Component, Input} from '@angular/core';

@Component({
  template: '',
  host: {
    '[id]': 'id',
    '[nested]': 'nested.id',
    '[receiverNarrowing]': 'receiverNarrowing ? receiverNarrowing.id',
    // normal narrowing is irrelevant as we don't type check host bindings.
  },
  standalone: false,
})
class HostBindingTestCmp {
  @Input() id = 'works';

  // for testing nested expressions.
  nested = this;

  declare receiverNarrowing: this | undefined;
}

const SHARED = {
  '(click)': 'id',
  '(mousedown)': 'id2',
};

@Component({
  template: '',
  host: SHARED,
  standalone: false,
})
class HostBindingsShared {
  @Input() id = false;
}

@Component({
  template: '',
  host: SHARED,
  standalone: false,
})
class HostBindingsShared2 {
  @Input() id = false;
  @Input() id2 = false;
}
