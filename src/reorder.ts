// Reordering thumbnails with Pointer Events — works with mouse, touch and pen.
//
// Mouse: press and move a few pixels to start dragging.
// Touch: press and hold (long-press) until the photo lifts, then drag. A quick swipe
// still scrolls the page as usual.

export interface ReorderOptions {
  /** CSS selector of draggable items. Each must have `data-id`. */
  item: string;
  canStart: () => boolean;
  onDrop: (id: number, targetId: number, after: boolean) => void;
}

const LONG_PRESS_MS = 350;
const TOUCH_SLOP = 10;
const MOUSE_SLOP = 5;
const EDGE = 90;

interface Drag {
  id: number;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  li: HTMLElement;
  started: boolean;
  timer: number;
  ghost: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  target: { el: HTMLElement; after: boolean } | null;
  raf: number;
}

export function initReorder(opts: ReorderOptions): void {
  let drag: Drag | null = null;

  const clearMarks = () =>
    document.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));

  const begin = () => {
    if (!drag || drag.started) return;
    if (!drag.li.isConnected) return cancel();
    drag.started = true;
    const r = drag.li.getBoundingClientRect();
    drag.offsetX = drag.startX - r.left;
    drag.offsetY = drag.startY - r.top;
    const ghost = drag.li.cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost');
    ghost.removeAttribute('data-id');
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.li.classList.add('dragging');
    document.body.classList.add('reordering');
    if (drag.touch) navigator.vibrate?.(15);
    move();
    drag.raf = requestAnimationFrame(autoScroll);
  };

  const move = () => {
    if (!drag?.ghost) return;
    drag.ghost.style.transform = `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px) scale(1.06)`;
    const under = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>(opts.item);
    clearMarks();
    drag.target = null;
    if (!under || under === drag.li) return;
    const r = under.getBoundingClientRect();
    const after = drag.x > r.left + r.width / 2;
    under.classList.add(after ? 'drop-after' : 'drop-before');
    drag.target = { el: under, after };
  };

  // Scroll the page when dragging near the top or bottom edge.
  const autoScroll = () => {
    if (!drag?.started) return;
    const bottomEdge = window.innerHeight - EDGE - 70; // leave room for the fixed footer
    let dy = 0;
    if (drag.y < EDGE) dy = -Math.ceil((EDGE - drag.y) / 6);
    else if (drag.y > bottomEdge) dy = Math.ceil((drag.y - bottomEdge) / 6);
    if (dy) {
      window.scrollBy(0, dy);
      move();
    }
    drag.raf = requestAnimationFrame(autoScroll);
  };

  const cleanup = () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.raf);
    drag.ghost?.remove();
    drag.li.classList.remove('dragging');
    document.body.classList.remove('reordering');
    clearMarks();
    drag = null;
  };

  const cancel = () => cleanup();

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const target = e.target as Element;
    const li = target.closest<HTMLElement>(opts.item);
    if (!li || target.closest('button') || !opts.canStart()) return;
    const touch = e.pointerType !== 'mouse';
    drag = {
      id: Number(li.dataset.id),
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      li,
      started: false,
      timer: touch ? window.setTimeout(begin, LONG_PRESS_MS) : 0,
      ghost: null,
      offsetX: 0,
      offsetY: 0,
      target: null,
      raf: 0,
    };
    if (!touch) e.preventDefault(); // avoid text selection / native image drag
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    const dist = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (!drag.started) {
      if (drag.touch) {
        if (dist > TOUCH_SLOP) cancel(); // it's a scroll, not a long-press
      } else if (dist > MOUSE_SLOP) begin();
      return;
    }
    move();
  });

  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { started, target, id } = drag;
    cleanup();
    if (started && target) opts.onDrop(id, Number(target.el.dataset.id), target.after);
  });

  document.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointerId) cancel();
  });

  // Once a touch drag has started, stop the page from scrolling under the finger.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (drag?.started) e.preventDefault();
    },
    { passive: false },
  );

  // Long-press on Android opens a context menu; suppress it on thumbnails.
  document.addEventListener('contextmenu', (e) => {
    if ((e.target as Element).closest(opts.item)) e.preventDefault();
  });

  window.addEventListener('blur', cancel);
}
