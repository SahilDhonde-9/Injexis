/**
 * RedLockX Guardrail Graph
 *
 * A LangGraph-style state machine that orchestrates the two detection layers
 * in parallel before merging into a single decision node.
 *
 *        START
 *          |
 *    ┌─────┴─────┐
 *    ↓           ↓
 * hybridNode   mlNode
 *    ↓           ↓
 *     └────┬────┘
 *          ↓
 *     decisionNode
 *          ↓
 *         END
 */

export interface GuardrailState {
  prompt: string;
  hybrid: HybridResult | null;
  ml: MlResult | null;
  final: FinalVerdict | null;
  errors: string[];
}

export interface HybridResult {
  verdictStr: string;
  riskPercent: number;
  isSafe: boolean;
}

export interface MlResult {
  status: string;
  confidence: number;
  binary_confidence?: number;
  attack_type?: { label: string; score: number };
  attack_family?: { label: string; score: number };
  trigger_words?: string[];
}

export interface FinalVerdict {
  verdict: "BLOCK" | "ALLOW";
  riskScore: number;
  isSafe: boolean;
  attackType: string | null;
  hybridProbability: number;
  mlStatus: string;
  mlConfidence: number;
  explanation: string;
}

type NodeFn = (state: GuardrailState) => Promise<Partial<GuardrailState>>;

type Edge =
  | { type: "sequential"; from: string; to: string }
  | { type: "parallel_start"; to: string[] }
  | { type: "parallel_join"; from: string[]; to: string };

interface CompiledGraph {
  invoke: (input: Pick<GuardrailState, "prompt">) => Promise<GuardrailState>;
}

/**
 * Minimal LangGraph-style StateGraph for TypeScript.
 * Supports parallel fan-out from START and fan-in to a single merge node.
 */
class StateGraph {
  private nodes = new Map<string, NodeFn>();
  private edges: Edge[] = [];

  addNode(name: string, fn: NodeFn) {
    this.nodes.set(name, fn);
    return this;
  }

  /** Fan-out from START → multiple nodes in parallel */
  addParallelStart(nodeNames: string[]) {
    this.edges.push({ type: "parallel_start", to: nodeNames });
    return this;
  }

  /** Fan-in: wait for all `from` nodes then execute `to` */
  addParallelJoin(fromNodes: string[], toNode: string) {
    this.edges.push({ type: "parallel_join", from: fromNodes, to: toNode });
    return this;
  }

  addEdge(from: string, to: string) {
    this.edges.push({ type: "sequential", from, to });
    return this;
  }

  compile(): CompiledGraph {
    const nodes = this.nodes;
    const edges = this.edges;

    return {
      async invoke(input: Pick<GuardrailState, "prompt">): Promise<GuardrailState> {
        let state: GuardrailState = {
          prompt: input.prompt,
          hybrid: null,
          ml: null,
          final: null,
          errors: [],
        };

        const parallelStart = edges.find((e) => e.type === "parallel_start") as
          | { type: "parallel_start"; to: string[] }
          | undefined;

        const parallelJoin = edges.find((e) => e.type === "parallel_join") as
          | { type: "parallel_join"; from: string[]; to: string }
          | undefined;

        const sequential = edges
          .filter((e) => e.type === "sequential")
          .map((e) => e as { type: "sequential"; from: string; to: string });

        if (parallelStart) {
          const parallelFns = parallelStart.to.map((name) => {
            const fn = nodes.get(name);
            if (!fn) throw new Error(`Node "${name}" not registered`);
            return fn(state);
          });

          const results = await Promise.allSettled(parallelFns);

          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === "fulfilled") {
              state = { ...state, ...r.value };
            } else {
              state.errors.push(`${parallelStart.to[i]}: ${String(r.reason)}`);
            }
          }
        }

        if (parallelJoin) {
          const fn = nodes.get(parallelJoin.to);
          if (!fn) throw new Error(`Node "${parallelJoin.to}" not registered`);
          const patch = await fn(state);
          state = { ...state, ...patch };
        }

        for (const edge of sequential) {
          const fn = nodes.get(edge.to);
          if (!fn) continue;
          const patch = await fn(state);
          state = { ...state, ...patch };
        }

        return state;
      },
    };
  }
}

export function createStateGraph(): StateGraph {
  return new StateGraph();
}
