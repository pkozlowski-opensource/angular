/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {ProceduralRenderer3, RComment, RElement, RNode, RText, Renderer3, RendererFactory3, RendererStyleFlags3} from '../../../src/render3/interfaces/renderer';

export class WebWorkerRenderNode implements RNode, RComment, RText {
  textContent: string|null = null;
  parentNode: RNode|null = null;
  parentElement: RElement|null = null;
  nextSibling: RNode|null = null;
  removeChild(oldChild: RNode): RNode { return oldChild; }
  insertBefore(newChild: RNode, refChild: RNode|null, isViewRoot: boolean): void {}
  appendChild(newChild: RNode): RNode { return newChild; }
}

export class SimpleDomRenderer implements ProceduralRenderer3 {

  constructor(private _document: any) {}

  destroy(): void {
  }  
  
  createComment(value: string): RComment {
    return this._document.createComment(value);
  }
  createElement(name: string, namespace?: string | null | undefined): RElement {
    return this._document.createElement(name);
  }
  createText(value: string): RText {
    return this._document.createTextNode(value);
  }
  destroyNode?: ((node: RNode) => void) | null | undefined;
  appendChild(parent: RElement, newChild: RNode): void {
    parent.appendChild(newChild);
  }
  insertBefore(parent: RNode, newChild: RNode, refChild: RNode | null): void {
    if (parent) {
      parent.insertBefore(newChild, refChild, false);
    }
  }
  removeChild(parent: RElement, oldChild: RNode, isHostElement?: boolean | undefined): void {
    if (parent) {
      parent.removeChild(oldChild);
    }
  }
  selectRootElement(selectorOrNode: any): RElement {
    throw new Error("Method not implemented.");
  }
  parentNode(node: RNode): RElement | null {
    return node.parentNode as RElement;
  }
  nextSibling(node: RNode): RNode | null {
    return node.nextSibling;
  }
  setAttribute(el: RElement, name: string, value: string, namespace?: string | null | undefined): void {
    el.setAttribute(name, value);
  }
  removeAttribute(el: RElement, name: string, namespace?: string | null | undefined): void {
    el.removeAttribute(name);
  }
  addClass(el: RElement, name: string): void {
    el.classList.add(name);
  }
  removeClass(el: RElement, name: string): void {
    el.classList.remove(name);
  }
  setStyle(el: RElement, style: string, value: any, flags?: RendererStyleFlags3|undefined): void {
    el.style.setProperty(style, value);
  }
  removeStyle(el: RElement, style: string, flags?: RendererStyleFlags3|undefined): void {
    el.style.removeProperty(style);
  }
  setProperty(el: RElement, name: string, value: any): void {
    (el as any)[name] = value;
  }
  setValue(node: RComment | RText, value: string): void {
    (node as any).nodeValue = value; 
  }
  listen(target: RNode | "document" | "window" | "body", eventName: string, callback: (event: any) => boolean | void): () => void {
    return (target as any).addEventListener(eventName, callback);
  }

}

export class NoopRenderer implements ProceduralRenderer3 {
  destroy(): void { throw new Error('Method not implemented.'); }
  createComment(value: string): RComment { return new WebWorkerRenderNode(); }
  createElement(name: string, namespace?: string|null|undefined): RElement {
    return new WebWorkerRenderNode() as any as RElement;
  }
  createText(value: string): RText { return new WebWorkerRenderNode(); }
  destroyNode?: ((node: RNode) => void)|null|undefined;
  appendChild(parent: RElement, newChild: RNode): void {}
  insertBefore(parent: RNode, newChild: RNode, refChild: RNode|null): void {}
  removeChild(parent: RElement, oldChild: RNode, isHostElement?: boolean|undefined): void {}
  selectRootElement(selectorOrNode: any): RElement { throw new Error('Method not implemented.'); }
  parentNode(node: RNode): RElement|null { throw new Error('Method not implemented.'); }
  nextSibling(node: RNode): RNode|null { throw new Error('Method not implemented.'); }
  setAttribute(el: RElement, name: string, value: string, namespace?: string|null|undefined): void {
  }
  removeAttribute(el: RElement, name: string, namespace?: string|null|undefined): void {}
  addClass(el: RElement, name: string): void {}
  removeClass(el: RElement, name: string): void {}
  setStyle(el: RElement, style: string, value: any, flags?: RendererStyleFlags3|undefined): void {}
  removeStyle(el: RElement, style: string, flags?: RendererStyleFlags3|undefined): void {}
  setProperty(el: RElement, name: string, value: any): void {}
  setValue(node: RComment|RText, value: string): void { node.textContent = value; }
  listen(
      target: RNode|'document'|'window'|'body', eventName: string,
      callback: (event: any) => boolean | void): () => void {
    return () => {};
  }
}

export class NoopRendererFactory implements RendererFactory3 {
  createRenderer(hostElement: RElement|null, rendererType: null): Renderer3 {
    return new NoopRenderer();
  }
}

export class DomRendererFactory implements RendererFactory3 {
  createRenderer(hostElement: RElement|null, rendererType: null): Renderer3 {
    return new SimpleDomRenderer(document);
  }
}
