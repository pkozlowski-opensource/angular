/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, Input, NgModule} from '@angular/core';
import {BrowserModule, DomSanitizer, SafeStyle} from '@angular/platform-browser';

import {emptyTable, TableCell} from '../util';

let trustedEmptyColor: SafeStyle;
let trustedGreyColor: SafeStyle;

@Component({
  selector: 'largetable',
  template: `<table><tbody>
    {#for (row of data); track $index}
    <tr>
    {#for (cell of row); track $index}
      <td [style.backgroundColor]="getColor(cell.row)">
      {{cell.value}}
      </td>
      {/for}
    </tr>
    {/for}
  </tbody></table>`,
})
export class TableComponent {
  @Input() data: TableCell[][] = emptyTable;

  trackByIndex(index: number, item: any) {
    return index;
  }

  getColor(row: number) {
    return row % 2 ? trustedEmptyColor : trustedGreyColor;
  }
}

@NgModule({imports: [BrowserModule], bootstrap: [TableComponent], declarations: [TableComponent]})
export class AppModule {
  constructor(sanitizer: DomSanitizer) {
    trustedEmptyColor = sanitizer.bypassSecurityTrustStyle('white');
    trustedGreyColor = sanitizer.bypassSecurityTrustStyle('grey');
  }
}
