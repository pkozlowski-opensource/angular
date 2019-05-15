/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
* Equivalent to ES6 spread, add each item to an array.
*
* @param items The items to add
* @param arr The array to which you want to add the items
*/
export function addAllToArray(items: any[], arr: any[]) {
  for (let i = 0; i < items.length; i++) {
    arr.push(items[i]);
  }
}

/**
 * Flattens an array. Input arrays are not modified.
 *
 * This implementation is memory efficient and only allocates objects when needed: we assume that a
 * list is already flat and only allocate a result array if the initial assumption turns out to be
 * invalid.
 */
export function flatten(list: any[], results?: any[]): any[] {
  const listLength = list.length;
  for (let i = 0; i < listLength; i++) {
    let item = list[i];
    if (Array.isArray(item)) {
      if (results === undefined) {
        // Our assumption tha the list was already flat was wrong and
        // we need to clone flat since we need to write to it.
        results = list.slice(0, i);
      }
      if (item.length > 0) {
        flatten(item, results);
      }
    } else if (results !== undefined) {
      results !.push(item);
    }
  }

  return results !== undefined ? results : list;
}
