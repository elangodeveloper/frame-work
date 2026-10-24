import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';
import { OverlayService } from '../core/overlay.ts';

export interface DialogProps {
  visible?: Signal<boolean> | boolean;
  header?: Signal<string> | string;
  modal?: boolean;
  closable?: boolean;
  dismissableMask?: boolean;
  width?: string;
  class?: string;
}

/**
 * Jarvis Dialog Adapter for PrimeNG v20 Dialog.
 * Selector: <jarvis-p-dialog>
 */
export class JarvisDialog extends JarvisPrimeComponent {
  readonly visibleChange: JarvisEvent<boolean> = jarvisEvent();
  readonly onShow: JarvisEvent<void> = jarvisEvent();
  readonly onHide: JarvisEvent<void> = jarvisEvent();

  private readonly props: DialogProps;
  private maskEl: any;
  private dialogEl: any;
  private headerTitleNode: any;
  private contentEl: any;
  private overlayId: number | null = null;
  private isShown = false;

  constructor(renderer: Renderer, props: DialogProps = {}) {
    super(renderer);
    this.props = props;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    // Backdrop / Mask
    this.maskEl = this.renderer.createElement('div');
    this.hostElement = this.maskEl;
    this.renderer.setAttribute(this.maskEl, 'class', 'p-dialog-mask');
    this.renderer.setProperty(this.maskEl, 'style', 'display: none;');

    // Inner Dialog Card
    this.dialogEl = this.renderer.createElement('div');
    this.renderer.setAttribute(this.dialogEl, 'class', 'p-dialog p-component');
    if (this.props.width) {
      this.renderer.setProperty(this.dialogEl, 'style', `width: ${this.props.width};`);
    }

    // Header bar
    const headerEl = this.renderer.createElement('div');
    this.renderer.setAttribute(headerEl, 'class', 'p-dialog-header');

    const titleEl = this.renderer.createElement('span');
    this.renderer.setAttribute(titleEl, 'class', 'p-dialog-title');
    this.headerTitleNode = this.renderer.createText('');
    this.renderer.appendChild(titleEl, this.headerTitleNode);
    this.renderer.appendChild(headerEl, titleEl);

    // Closable action icon
    if (this.props.closable !== false) {
      const closeBtn = this.renderer.createElement('button');
      this.renderer.setAttribute(closeBtn, 'class', 'p-dialog-header-close p-button-text');
      const closeIcon = this.renderer.createElement('span');
      this.renderer.setAttribute(closeIcon, 'class', 'pi pi-times');
      this.renderer.appendChild(closeBtn, closeIcon);
      this.renderer.listen(closeBtn, 'click', () => {
        this.close();
      });
      this.renderer.appendChild(headerEl, closeBtn);
    }

    this.renderer.appendChild(this.dialogEl, headerEl);

    // Content container (for projected children)
    this.contentEl = this.renderer.createElement('div');
    this.renderer.setAttribute(this.contentEl, 'class', 'p-dialog-content');
    this.renderer.appendChild(this.dialogEl, this.contentEl);

    this.renderer.appendChild(this.maskEl, this.dialogEl);

    // Dismissable mask click
    if (this.props.dismissableMask) {
      this.renderer.listen(this.maskEl, 'click', (event: any) => {
        if (event.target === this.maskEl) {
          this.close();
        }
      });
    }
  }

  private bindProperties(): void {
    // 1. Reactive visibility
    this.bindReactive(
      () => Boolean(unwrap(this.props.visible)),
      (visible) => {
        if (visible && !this.isShown) {
          this.open();
        } else if (!visible && this.isShown) {
          this.close();
        }
      }
    );

    // 2. Reactive header
    this.bindReactive(
      () => unwrap(this.props.header) ?? '',
      (title) => {
        this.renderer.setText(this.headerTitleNode, title);
      }
    );
  }

  open(): void {
    this.isShown = true;
    const zIndex = OverlayService.nextZIndex();
    this.renderer.setProperty(this.maskEl, 'style', `display: flex; z-index: ${zIndex};`);
    this.overlayId = OverlayService.register({
      onDismiss: () => this.close(),
    });
    this.onShow.emit();
  }

  close(): void {
    this.isShown = false;
    this.renderer.setProperty(this.maskEl, 'style', 'display: none;');
    if (this.overlayId != null) {
      OverlayService.unregister(this.overlayId);
      this.overlayId = null;
    }
    this.visibleChange.emit(false);
    this.onHide.emit();
  }

  getContentContainer(): any {
    return this.contentEl;
  }

  override destroy(): void {
    this.close();
    super.destroy();
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
