/**
 * Order lifecycle — node graph view.
 *
 * Every state an order passes through is its own node on the canvas.
 * Nodes are connected in the order they happened: Pending → Processing
 * → Shipped → Delivered, or the partial sequence for a cancelled /
 * refunded order (ending in a terminal node where the order diverged).
 *
 * When an order spawned a replacement, its terminal node is marked as
 * a "divergence" node and an orthogonal step-path routes from it into
 * the replacement order's Pending node — so you can follow the full
 * customer case as a single flow graph moving left-to-right then
 * down-across-down between lanes.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  GitBranch,
  Loader2,
  Package,
  Truck,
  Undo2,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import type {
  Order,
  OrderHistoryEntry,
  OrderStatus,
  PaymentStatus,
} from '../../types';

interface TreeNode {
  order: Order;
  children: TreeNode[];
}

const FLOW_STATES: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered'];

const STATE_META: Record<
  OrderStatus,
  { label: string; icon: React.ElementType }
> = {
  Pending: { label: 'Pending', icon: Clock },
  Confirmed: { label: 'Confirmed', icon: Check },
  Processing: { label: 'Processing', icon: Package },
  Shipped: { label: 'Shipped', icon: Truck },
  Delivered: { label: 'Delivered', icon: Check },
  Cancelled: { label: 'Cancelled', icon: XCircle },
  Refunded: { label: 'Refunded', icon: Undo2 },
  Archived: { label: 'Archived', icon: XCircle },
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(n || 0);

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

const displayNumber = (o: Order) =>
  o.orderNumber
    ? `#${String(o.orderNumber).replace(/^#+/, '')}`
    : `#${o._id.slice(-8)}`;

/** Small colored dot used on the OrderNode to indicate payment status
 * without the heavier badge that clashes with terminal state nodes. */
const paymentDotClass = (s?: PaymentStatus) => {
  switch (s) {
    case 'Paid':
      return 'bg-emerald-400';
    case 'Failed':
      return 'bg-rose-500';
    case 'Refunded':
    case 'Partially Refunded':
      return 'bg-amber-400';
    default:
      return 'bg-slate-400';
  }
};

/**
 * Build a replacement-chain tree rooted at the given order. We do NOT
 * walk up to the original root — the tree starts from `startId` so
 * you see only "this order and its replacements forward". The parent
 * chain is reachable by clicking the "Order replaced" strip on the
 * starting order, which navigates to that parent's lifecycle page.
 */
/** The /orders/:id endpoint wraps the order in either `data` (legacy)
 * or `responseObject` (modern). Either one can contain the order
 * directly or nested under `.order`, so we probe both shapes. */
interface OrderByIdEnvelope {
  data?: Order | { order?: Order };
  responseObject?: Order | { order?: Order };
}

const unwrapOrder = (res: unknown): Order => {
  const env = (res ?? {}) as OrderByIdEnvelope;
  const fromData =
    (env.data as { order?: Order } | undefined)?.order ||
    (env.data as Order | undefined);
  const fromResponseObject =
    (env.responseObject as { order?: Order } | undefined)?.order ||
    (env.responseObject as Order | undefined);
  return (fromData || fromResponseObject) as Order;
};

async function buildOrderTree(startId: string): Promise<TreeNode> {
  const cache = new Map<string, Order>();
  const fetchOrder = async (id: string): Promise<Order> => {
    if (cache.has(id)) return cache.get(id)!;
    const res = await api.orders.getById(id);
    const o = unwrapOrder(res);
    cache.set(o._id, o);
    return o;
  };

  const start = await fetchOrder(startId);

  const expand = async (order: Order): Promise<TreeNode> => {
    const childIds = (order.replacementOrders || []).map(String);
    const children = await Promise.all(
      childIds.map(async (id) => {
        const child = await fetchOrder(id);
        return expand(child);
      }),
    );
    return { order, children };
  };
  return expand(start);
}

const findStateTimestamp = (
  history: OrderHistoryEntry[],
  createdAt: string,
  state: OrderStatus,
): string | undefined => {
  if (state === 'Pending') return createdAt;
  const entry = history.find(
    (h) => h.event === 'status_changed' && h.status === state,
  );
  return entry?.at;
};

/**
 * Index into FLOW_STATES the order has reached. For live orders this
 * is the current status; for terminal orders it's the last happy-path
 * state touched before the branch — i.e. where it diverged.
 */
const computeReachedIdx = (order: Order): number => {
  const history = order.history || [];
  const isTerminalBranch =
    order.status === 'Cancelled' || order.status === 'Refunded';
  if (isTerminalBranch) {
    let hi = -1;
    for (let i = 0; i < FLOW_STATES.length; i++) {
      if (findStateTimestamp(history, order.createdAt, FLOW_STATES[i])) hi = i;
    }
    return hi; // may be -1 if the order was cancelled before any history
  }
  const idx = FLOW_STATES.indexOf(order.status);
  return idx === -1 ? 0 : idx;
};

interface FlowNode {
  key: string;
  status: OrderStatus;
  at?: string;
  reached: boolean;
  isCurrent: boolean;
  isTerminal: boolean;
  isDivergence: boolean;
}

/**
 * Build the chronological sequence of state nodes for a single order.
 * Happy-path states that were actually traversed come first; if the
 * order ended in a Cancelled/Refunded terminal state, that is appended
 * as the final node. When the order has replacements the final node is
 * marked as the divergence point so the layout can draw a step-path
 * from it to the child's first node.
 */
const buildFlowNodes = (order: Order, hasReplacements: boolean): FlowNode[] => {
  const history = order.history || [];
  const isTerminalBranch =
    order.status === 'Cancelled' || order.status === 'Refunded';
  const reachedIdx = computeReachedIdx(order);

  const nodes: FlowNode[] = [];
  // Happy-path nodes — traversed so far (and the rest as "future" if not terminal)
  const cutoff = isTerminalBranch ? reachedIdx : FLOW_STATES.length - 1;
  for (let i = 0; i < FLOW_STATES.length; i++) {
    const s = FLOW_STATES[i];
    const reached = i <= reachedIdx;
    if (isTerminalBranch && i > cutoff) break;
    nodes.push({
      key: `s-${i}`,
      status: s,
      at: findStateTimestamp(history, order.createdAt, s),
      reached,
      isCurrent: !isTerminalBranch && i === reachedIdx,
      isTerminal: false,
      isDivergence: false,
    });
  }
  if (isTerminalBranch) {
    const termAt = history.find(
      (h) => h.event === 'status_changed' && h.status === order.status,
    )?.at;
    nodes.push({
      key: 'terminal',
      status: order.status,
      at: termAt,
      reached: true,
      isCurrent: true,
      isTerminal: true,
      isDivergence: hasReplacements,
    });
  } else if (hasReplacements && nodes.length > 0) {
    // Unusual but handle: replacement from a non-terminal order. Mark
    // the last reached node as the divergence so the path still routes.
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].reached) {
        nodes[i].isDivergence = true;
        break;
      }
    }
  }
  return nodes;
};

interface StateNodeViewProps {
  node: FlowNode;
  orderId: string;
  index: number;
  isLaneCurrent: boolean;
}

/**
 * Single state node. Pill-shaped box with icon + label + timestamp.
 * The divergence attribute tells the SVG overlay this is the source
 * of a replacement connector.
 */
const StateNodeView: React.FC<StateNodeViewProps> = ({
  node,
  orderId,
  index,
  isLaneCurrent,
}) => {
  const meta = STATE_META[node.status];
  const Icon = meta.icon;
  const isHere = isLaneCurrent && node.isCurrent;

  // Color strategy:
  //   terminal (Cancelled/Refunded) → rose
  //   reached (past or current)     → primary filled
  //   future                         → muted outline
  let nodeClass: string;
  if (node.isTerminal) {
    nodeClass =
      'bg-rose-500 text-white border-rose-500 dark:bg-rose-600 dark:border-rose-600';
  } else if (node.reached) {
    nodeClass = 'bg-primary text-primary-foreground border-primary';
  } else {
    nodeClass = 'bg-background text-muted-foreground border-border';
  }

  return (
    <div
      data-node-key={`${orderId}:${node.key}`}
      data-is-divergence={node.isDivergence ? 'true' : undefined}
      data-flow-order={orderId}
      data-flow-idx={index}
      data-flow-reached={node.reached ? 'true' : 'false'}
      data-flow-terminal={node.isTerminal ? 'true' : 'false'}
      className="relative shrink-0"
    >
      <div
        className={
          'relative inline-flex h-14 min-w-[120px] items-center gap-2 rounded-lg border-2 px-3 shadow-sm transition ' +
          nodeClass +
          (isHere ? ' ring-4 ring-primary/25' : '') +
          (node.isDivergence ? ' pr-5' : '')
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-xs font-semibold whitespace-nowrap">{meta.label}</span>
          <span
            className={
              'text-[10px] whitespace-nowrap ' +
              (node.reached && !node.isTerminal
                ? 'text-primary-foreground/80'
                : node.isTerminal
                  ? 'text-rose-100'
                  : 'text-muted-foreground')
            }
          >
            {node.at ? formatDate(node.at) : '—'}
          </span>
        </div>
      </div>
      {/* Divergence badge — a little fork icon floating at the top-right
          of the node to signal "a replacement was created from here" */}
      {node.isDivergence && (
        <div
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-indigo-500 text-white shadow"
          title="Replacement created from here"
        >
          <GitBranch className="h-3 w-3" />
        </div>
      )}
    </div>
  );
};

interface OrderNodeViewProps {
  order: Order;
  isCurrent: boolean;
  parentOnCanvas: boolean;
  onRevealParent?: () => void;
}

/**
 * Order node — entry point for an order's chain. Has a top "origin
 * strip" that reads "Order placed" for a fresh order or "Order
 * replaced" for a replacement; clicking the replaced strip navigates
 * to the parent order's lifecycle, revealing its history. The node
 * itself holds the metadata (number, customer, total, payment badge)
 * and is the target for incoming replacement connectors.
 */
const OrderNodeView: React.FC<OrderNodeViewProps> = ({
  order,
  isCurrent,
  parentOnCanvas,
  onRevealParent,
}) => {
  const isReplacement = !!order.replacementOf;
  // Show the "Order replaced" wording on the feeder line only when the
  // parent isn't visible on canvas. When it IS visible, the same label
  // gets drawn directly on the SVG connector that runs between the
  // parent's Refunded/Cancelled pill and this order — so the feeder
  // line stays short and unlabeled, just like a fresh order's stub.
  const showReplacedLabel = isReplacement && !parentOnCanvas;
  const subtitle =
    (order.user?.name || order.guestCustomer?.firstName || 'Guest') +
    ' · ' +
    formatPrice(order.totalAmount);

  // Labeled feeder line — replaces the old origin chip. Renders as a
  // horizontal line with the origin label sitting "on" the line (the
  // text is just inline between two stub segments, so it visually
  // breaks the line at the label without needing to mask anything).
  // For replacement orders the whole element is a clickable button
  // that navigates to the parent order's lifecycle. The wrapper still
  // carries `data-is-first` so the SVG replacement connectors land on
  // it instead of the order body.
  const lineColor = isReplacement
    ? 'bg-indigo-500'
    : 'bg-slate-400 dark:bg-slate-600';
  const labelColor = isReplacement
    ? 'text-indigo-600 dark:text-indigo-300'
    : 'text-slate-600 dark:text-slate-300';
  const arrowFill = isReplacement
    ? 'fill-indigo-500'
    : 'fill-slate-400 dark:fill-slate-600';

  // The label only appears on the feeder line for fresh orders, or for
  // replacements whose parent is NOT on canvas. Otherwise the line is
  // an unlabeled stub and the "Order replaced" wording is rendered on
  // the SVG connector instead (computed in computeConnectors).
  const showLabel = !isReplacement || showReplacedLabel;
  const labelText = isReplacement ? 'Order replaced' : 'Order placed';

  const labeledLineInner = (
    <>
      <div className={'h-0.5 w-6 ' + lineColor} />
      {showLabel && (
        <>
          <span
            className={
              'px-2 text-[13px] font-semibold uppercase tracking-wide whitespace-nowrap ' +
              labelColor
            }
          >
            {labelText}
          </span>
          <div className={'h-0.5 w-6 ' + lineColor} />
        </>
      )}
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
        <path d="M 0 0 L 10 5 L 0 10 z" className={arrowFill} />
      </svg>
    </>
  );

  const labeledLine = showReplacedLabel ? (
    <button
      type="button"
      data-is-first="true"
      onClick={onRevealParent}
      className="group flex h-14 items-center transition hover:opacity-80"
      title="View the original order's lifecycle"
    >
      {labeledLineInner}
    </button>
  ) : (
    <div data-is-first="true" className="flex h-14 items-center">
      {labeledLineInner}
    </div>
  );

  return (
    <div className="flex items-center shrink-0">
      {/* When the parent IS on canvas, drop the feeder stub entirely and
          let the SVG replacement connector land directly on the order
          body (data-is-first moves there). Otherwise show the labeled
          feeder line as the entry point. */}
      {!parentOnCanvas && labeledLine}
      <div
        data-flow-order={order._id}
        data-flow-idx={-1}
        data-flow-reached="true"
        data-flow-terminal="false"
        data-is-first={parentOnCanvas ? 'true' : undefined}
        className={
          'relative flex h-14 items-center gap-2.5 rounded-lg border-2 bg-slate-900 px-3 text-white shadow-md transition dark:bg-slate-800 ' +
          (isCurrent ? 'border-primary ring-4 ring-primary/25' : 'border-slate-700')
        }
        style={{ minWidth: 200 }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-700">
          <Package className="h-4 w-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/dashboard/orders/${order._id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {displayNumber(order)}
              <ArrowUpRight className="h-3 w-3 opacity-70" />
            </Link>
            <span
              title={`Payment: ${order.paymentStatus}`}
              className={'h-2 w-2 rounded-full ' + paymentDotClass(order.paymentStatus)}
            />
          </div>
          <div className="text-[11px] text-slate-300 whitespace-nowrap">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrderRowProps {
  order: Order;
  hasReplacements: boolean;
  isCurrent: boolean;
  parentOnCanvas: boolean;
  onRevealParent?: () => void;
}

/**
 * One chronological row per order: the order node (metadata) followed
 * by its state nodes. Rows stack vertically with enough gap for the
 * orthogonal replacement connectors to route between them.
 */
const OrderRow: React.FC<OrderRowProps> = ({
  order,
  hasReplacements,
  isCurrent,
  parentOnCanvas,
  onRevealParent,
}) => {
  const nodes = useMemo(
    () => buildFlowNodes(order, hasReplacements),
    [order, hasReplacements],
  );

  return (
    <div
      data-order-card={order._id}
      data-order-id={order._id}
      className="flex items-start gap-12"
    >
      <OrderNodeView
        order={order}
        isCurrent={isCurrent}
        parentOnCanvas={parentOnCanvas}
        onRevealParent={onRevealParent}
      />
      {/* State chain — laid out as a fixed 3-column grid so the chain
          always spans multiple rows, even on wide viewports. The
          connecting lines are NOT static divs; they're drawn by the
          SVG overlay in `computeConnectors`, which traces orthogonal
          step paths between consecutive nodes. When a pair lives on
          the same grid row the line is straight; when the next node
          wraps to the row below, the line U-turns across the gap
          (right out, down to mid-gap, left across, down, right in),
          so the lifecycle reads continuously through the wrap. */}
      <div className="grid flex-1 min-w-0 grid-cols-3 items-center justify-items-start gap-x-12 gap-y-14">
        {nodes.map((n, i) => (
          <StateNodeView
            key={n.key}
            node={n}
            orderId={order._id}
            index={i}
            isLaneCurrent={isCurrent}
          />
        ))}
      </div>
    </div>
  );
};

interface FlatNode {
  node: TreeNode;
  depth: number;
}
const flatten = (node: TreeNode, depth = 0): FlatNode[] => {
  const out: FlatNode[] = [{ node, depth }];
  for (const c of node.children) out.push(...flatten(c, depth + 1));
  return out;
};

interface ConnectorPath {
  d: string;
  cls: string;
  arrow: boolean;
  /** Optional text rendered on the path's horizontal middle segment.
   * Used by replacement edges to label the connector with "Order
   * replaced" so the parent → child relationship reads inline. */
  label?: string;
  labelX?: number;
  labelY?: number;
  labelCls?: string;
}

/**
 * Build connector paths for the canvas. Two flavours:
 *
 *   1. Chain paths — for each order, walk its [data-flow-order=ID]
 *      elements in order of [data-flow-idx] and connect each consecutive
 *      pair. Same-row pairs get a straight horizontal line; cross-row
 *      pairs (caused by flex-wrap) get a U-turn step (right out, down,
 *      across, down, left in) so the line "traces" through the wrap
 *      like text. This makes the lifecycle read continuously even when
 *      it spans multiple rows.
 *   2. Replacement paths — between a parent's divergence node (the
 *      Cancelled/Refunded pill) and the child order's "Order replaced"
 *      origin chip. These keep the existing down→across→down step
 *      shape and an arrow head, since they jump lanes.
 *
 * All paths are H/V-only — no curves — to keep the wireframe feel.
 */
const computeConnectors = (
  container: HTMLDivElement,
  root: TreeNode,
  flat: FlatNode[],
): { width: number; height: number; paths: ConnectorPath[] } => {
  const cRect = container.getBoundingClientRect();

  const paths: ConnectorPath[] = [];

  const colorFor = (toEl: HTMLElement): string => {
    const reached = toEl.dataset.flowReached === 'true';
    const terminal = toEl.dataset.flowTerminal === 'true';
    if (terminal) return 'stroke-rose-500';
    if (reached) return 'stroke-primary';
    return 'stroke-slate-300 dark:stroke-slate-700';
  };

  // Chain paths for each order's nodes (order body → state 0 → state 1 → ...)
  for (const { node } of flat) {
    const orderId = node.order._id;
    const els = Array.from(
      container.querySelectorAll<HTMLElement>(
        `[data-flow-order="${orderId}"]`,
      ),
    );
    els.sort(
      (a, b) =>
        parseInt(a.dataset.flowIdx || '0', 10) -
        parseInt(b.dataset.flowIdx || '0', 10),
    );
    for (let i = 0; i < els.length - 1; i++) {
      const a = els[i].getBoundingClientRect();
      const b = els[i + 1].getBoundingClientRect();
      const Ax = a.right - cRect.left;
      const Ay = a.top + a.height / 2 - cRect.top;
      const Bx = b.left - cRect.left;
      const By = b.top + b.height / 2 - cRect.top;

      const sameRow = Math.abs(Ay - By) < 4;
      let d: string;
      if (sameRow) {
        d = `M ${Ax} ${Ay} L ${Bx} ${By}`;
      } else {
        // U-turn around the row gap. padOut buys a small horizontal
        // stub so the line breaks cleanly off the node edge.
        const padOut = 14;
        const midY = (Ay + By) / 2;
        d =
          `M ${Ax} ${Ay} ` +
          `L ${Ax + padOut} ${Ay} ` +
          `L ${Ax + padOut} ${midY} ` +
          `L ${Bx - padOut} ${midY} ` +
          `L ${Bx - padOut} ${By} ` +
          `L ${Bx} ${By}`;
      }
      paths.push({ d, cls: colorFor(els[i + 1]), arrow: false });
    }
  }

  // Replacement paths — divergence pill → child's "Order replaced" chip.
  const walk = (n: TreeNode) => {
    for (const child of n.children) {
      const fromEl = container.querySelector<HTMLElement>(
        `[data-order-card="${n.order._id}"] [data-is-divergence="true"]`,
      );
      const toEl = container.querySelector<HTMLElement>(
        `[data-order-card="${child.order._id}"] [data-is-first="true"]`,
      );
      if (fromEl && toEl) {
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const fromX = fromRect.left + fromRect.width / 2 - cRect.left;
        const fromY = fromRect.bottom - cRect.top + 2;
        const toX = toRect.left + toRect.width / 2 - cRect.left;
        const toY = toRect.top - cRect.top - 8;
        const midY = (fromY + toY) / 2;
        const d = `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
        paths.push({
          d,
          cls: 'stroke-indigo-500',
          arrow: true,
          label: 'Order replaced',
          labelX: (fromX + toX) / 2,
          labelY: midY,
          labelCls: 'fill-indigo-600 dark:fill-indigo-300',
        });
      }
      walk(child);
    }
  };
  walk(root);

  return {
    width: container.scrollWidth,
    height: container.scrollHeight,
    paths,
  };
};

const OrderLifecycle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectors, setConnectors] = useState<{
    width: number;
    height: number;
    paths: ConnectorPath[];
  }>({ width: 0, height: 0, paths: [] });
  const containerRef = useRef<HTMLDivElement>(null);

  useSetBreadcrumbs(
    root
      ? [
          { label: 'Orders', href: '/dashboard/orders' },
          {
            label: `#${String(root.order.orderNumber || root.order._id).replace(/^#+/, '')}`,
            href: `/dashboard/orders/${root.order._id}`,
          },
          { label: 'Timeline' },
        ]
      : null
  );

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const tree = await buildOrderTree(id);
        setRoot(tree);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : null;
        toast.error(msg || 'Failed to load order lifecycle');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!root || !id) return;
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-order-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [root, id]);

  const flat = useMemo(() => (root ? flatten(root) : []), [root]);
  // IDs of every order currently rendered on the canvas — used to
  // decide whether a replacement order's parent is also visible. If
  // the parent is on canvas, the "Order replaced" wording moves from
  // the child's feeder line onto the SVG connector that links them.
  const onCanvasIds = useMemo(
    () => new Set(flat.map((f) => f.node.order._id)),
    [flat],
  );

  // Measure & route the SVG connectors after layout. ResizeObserver
  // reruns on any size change so the overlay stays pinned to the nodes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !root) return;
    const recompute = () => setConnectors(computeConnectors(el, root, flat));
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [root, flat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!root) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Could not load order lifecycle.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/orders/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5" /> Order timeline
            </h1>
            <p className="text-sm text-muted-foreground">
              {flat.length === 1
                ? 'Standalone order — no replacements linked.'
                : `${flat.length} orders in this case, rooted at ${displayNumber(root.order)}.`}
            </p>
          </div>
        </div>
      </div>

      {/* Canvas — full-width scroll wrapper. The inner board is what
          the connector layout measures; its padding gives divergence
          badges and SVG arrow heads breathing room so nothing is
          clipped by the scroll container's implicit overflow-y. The
          subtle dot-grid background evokes a design canvas. */}
      <div
        className="w-full rounded-lg border bg-muted/20"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgb(100 116 139 / 0.45) 1.25px, transparent 1.25px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div
          ref={containerRef}
          className="relative w-full px-8 pt-6 pb-8"
        >
          {connectors.paths.length > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-20"
              width={connectors.width}
              height={connectors.height}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker
                  id="lifecycle-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" className="fill-indigo-500" />
                </marker>
              </defs>
              {connectors.paths.map((p, i) => (
                <g key={i}>
                  <path
                    d={p.d}
                    className={p.cls}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    markerEnd={p.arrow ? 'url(#lifecycle-arrow)' : undefined}
                  />
                  {p.label && (
                    <text
                      x={p.labelX}
                      y={p.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={
                        'text-[13px] font-semibold uppercase tracking-wide ' +
                        (p.labelCls || '')
                      }
                      style={{
                        // paint-order trick: stroke first with the canvas
                        // bg color so the text "punches through" the line
                        // behind it without needing a separate mask rect.
                        paintOrder: 'stroke',
                        stroke: 'hsl(var(--background))',
                        strokeWidth: 8,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          )}

          <div className="relative z-10 flex flex-col gap-24">
            {flat.map(({ node }) => (
              <OrderRow
                key={node.order._id}
                order={node.order}
                hasReplacements={node.children.length > 0}
                isCurrent={node.order._id === id}
                parentOnCanvas={
                  !!node.order.replacementOf &&
                  onCanvasIds.has(String(node.order.replacementOf))
                }
                onRevealParent={
                  node.order.replacementOf
                    ? () =>
                        navigate(
                          `/dashboard/orders/${node.order.replacementOf}/lifecycle`,
                        )
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderLifecycle;
