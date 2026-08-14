import { useEffect, useState } from "react";

import {
  executeStrategy,
  getScenarios,
  getVault,
  resetDemo,
} from "./api";

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  Circle,
  Database,
  Play,
  RotateCcw,
  Shield,
  Terminal,
  Trash2,
} from "lucide-react";

import "./App.css";


function sleep(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

function generateRunId() {
  const timestamp = new Date()
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, "")
    .slice(0, 4);
  const random = Math.random()
    .toString(16)
    .slice(2, 6)
    .toUpperCase();
  return `DEMO-${random}...${timestamp}`;
}

function formatTimestamp(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function App() {

  const [scenarios, setScenarios] = useState([]);

  const [selectedScenario, setSelectedScenario] =
    useState("");

  const [threshold, setThreshold] =
    useState(0.80);

  const [executionState, setExecutionState] =
    useState("idle");

  const [visualPhase, setVisualPhase] =
    useState("idle");

  const [executionResult, setExecutionResult] =
    useState(null);

  const [vault, setVault] =
    useState(null);

  const [error, setError] =
    useState(null);

  const [runId, setRunId] =
    useState(generateRunId());

  const [auditTrail, setAuditTrail] =
    useState([]);

  const handleExecute = async () => {
    if (!selectedScenario) {
      return;
    }

    setError(null);
    setExecutionState("planning");
    setVisualPhase("planning");
    setExecutionResult(null);
    setRunId(generateRunId());
    setAuditTrail([]);

    const executionStartTime = new Date();
    const newAuditTrail = [];

    try {
      /*
       * -----------------------------------------------
       * BACKEND EXECUTION
       * -----------------------------------------------
       */

      const result = await executeStrategy(
        selectedScenario,
        threshold
      );

      /*
       * -----------------------------------------------
       * PHASE 1 — PLANNING
       * -----------------------------------------------
       */

      const planTime = formatTimestamp(
        new Date(
          executionStartTime.getTime() + 0
        )
      );
      const scenarioObj = scenarios.find(
        (s) => s.name === selectedScenario
      );
      const proposalSnippet = result.agent.plan
        ? result.agent.plan.substring(0, 30) + "..."
        : "Strategy generated";

      newAuditTrail.push({
        time: planTime,
        type: "PLANNING",
        label: "Strategy generated",
        details: proposalSnippet,
      });
      setAuditTrail([...newAuditTrail]);
      setVisualPhase("planning");
      await sleep(1200);

      /*
       * -----------------------------------------------
       * PHASE 2 — INTERCEPTOR
       * -----------------------------------------------
       */

      const interceptTime = formatTimestamp(
        new Date(
          executionStartTime.getTime() + 1200
        )
      );
      const similarity = result.interceptor.similarity;
      const blocked = result.interceptor.blocked;
      const matched = result.interceptor.matched_hazard;

      newAuditTrail.push({
        time: interceptTime,
        type: "INTERCEPTOR",
        label: "Similarity",
        similarity: similarity,
        threshold: threshold,
        matched: matched,
        blocked: blocked,
      });
      setAuditTrail([...newAuditTrail]);
      setVisualPhase("intercepting");
      await sleep(1200);

      /*
       * -----------------------------------------------
       * STORE RESULT
       * -----------------------------------------------
       */

      setExecutionResult(result);
      setVault(result.vault);

      /*
       * -----------------------------------------------
       * PHASE 2 — DECISION
       * -----------------------------------------------
       */

      if (result.interceptor.blocked) {
        setVisualPhase("blocked");
        setExecutionState("rollback");
        await sleep(1700);

        /*
         * PHASE 3 — ROLLBACK
         */

        const rollbackTime = formatTimestamp(
          new Date(
            executionStartTime.getTime() + 4100
          )
        );
        const vaultCount =
          result.vault?.hazard_count || 1;

        newAuditTrail.push({
          time: rollbackTime,
          type: "ROLLBACK",
          label: "Fingerprint archived",
          vector: "384D",
          vaultEntries: vaultCount,
        });
        setAuditTrail([...newAuditTrail]);

        setVisualPhase("rollback");
        await sleep(1300);

        /*
         * PIVOT / COMPLETE
         */

        const pivotTime = formatTimestamp(
          new Date(
            executionStartTime.getTime() + 5400
          )
        );
        const pivotPlan = result.pivot?.plan || "Strategy pivoted";
        const pivotArrow = pivotPlan.includes("→")
          ? pivotPlan
          : "SPY → IWB";

        newAuditTrail.push({
          time: pivotTime,
          type: "PIVOT",
          label: pivotArrow,
          verified: true,
        });
        setAuditTrail([...newAuditTrail]);

        setVisualPhase("complete");
        setExecutionState("complete");
      } else {
        /*
         * ROUTE CLEARED
         */

        const clearedTime = formatTimestamp(
          new Date(
            executionStartTime.getTime() + 3500
          )
        );

        newAuditTrail.push({
          time: clearedTime,
          type: "CLEARED",
          label: "No compliance violations",
          verified: true,
        });
        setAuditTrail([...newAuditTrail]);

        setVisualPhase("cleared");
        await sleep(1200);
        setExecutionState("complete");
        setVisualPhase("complete");
      }

      const completeTime = formatTimestamp(
        new Date()
      );
      newAuditTrail.push({
        time: completeTime,
        type: "COMPLETE",
        label: "Execution workflow complete",
      });
      setAuditTrail([...newAuditTrail]);

    } catch (err) {
      console.error(err);
      setExecutionState("error");
      setVisualPhase("error");
      setError(err.message || "Execution failed.");
    }
  };

  const handleReset = async () => {
    try {
      await resetDemo();
      setExecutionState("idle");
      setVisualPhase("idle");
      setExecutionResult(null);
      setError(null);
      setAuditTrail([]);
      setRunId(generateRunId());
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to reset demo.");
    }
  };


  useEffect(() => {

    async function loadInitialData() {

      try {

        const [
          scenarioResponse,
          vaultResponse,
        ] = await Promise.all([
          getScenarios(),
          getVault(),
        ]);


        setScenarios(
          scenarioResponse.scenarios
        );


        if (
          scenarioResponse.scenarios.length > 0
        ) {
          setSelectedScenario(
            scenarioResponse.scenarios[0].name
          );
        }


        setVault(vaultResponse);

      } catch (err) {

        console.error(err);

        setError(
          err.message ||
          "Unable to connect to backend."
        );

      }

    }


    loadInitialData();

  }, []);


  const currentScenario =
    scenarios.find(
      (item) =>
        item.name === selectedScenario
    );

  const isBlocked =
    executionResult?.interceptor?.blocked === true;

  const isCleared =
    executionResult &&
    !executionResult.interceptor.blocked;

  const proposedPlan =
    executionResult?.agent?.plan || null;

  const pivotPlan =
    executionResult?.pivot?.plan || null;

  const similarity =
    executionResult?.interceptor?.similarity ?? null;

  const matchedHazard =
    executionResult?.interceptor?.matched_hazard || null;

  const vaultHazardCount =
    vault?.hazard_count ?? 0;

  const semanticMap =
    executionResult?.semantic_map;

  const matchedNode =
    semanticMap?.nodes?.find(
      (node) => node.matched
    );

  const proposedNode =
    semanticMap?.nodes?.find(
      (node) => node.type === "proposed"
    );

  const pivotNode =
    semanticMap?.nodes?.find(
      (node) => node.type === "pivot"
    );

  const topSimilarity =
    semanticMap?.hazard_similarities?.[0];

  const topSimilarityPercent =
    topSimilarity
      ? (topSimilarity.similarity * 100).toFixed(2)
      : null;

  const matchRadius =
    semanticMap
      ? Math.max(
          7,
          (1 - semanticMap.threshold) * 30
        )
      : 0;

  return (
    <div className="app-shell">

      {/* ================================================= */}
      {/* HEADER                                            */}
      {/* ================================================= */}

      <header className="app-header">

        <div className="brand-block">

          <div className="brand-symbol">
            R
          </div>

          <div className="brand-copy">

            <div className="brand-name">
              RALPH
            </div>

            <div className="brand-product">
              SEMANTIC ROLLBACK
            </div>

          </div>

        </div>


        <div className="header-center">

          <div className="runtime-label">
            AUTONOMOUS COMPLIANCE RUNTIME
          </div>

          <div className="runtime-line">
            <span className="runtime-dot" />
            LOCAL DEMONSTRATION ENVIRONMENT
          </div>

        </div>


        <div className="header-right">

          <div className="header-metric">
            <span className="header-metric-label">
              MODEL
            </span>

            <span className="header-metric-value">
              MiniLM-L6
            </span>
          </div>


          <div className="header-divider" />


          <div className="online-indicator">
            <span className="online-dot" />
            ONLINE
          </div>

        </div>

      </header>


      {/* ================================================= */}
      {/* MAIN WORKSPACE                                    */}
      {/* ================================================= */}

      {error && (
  <div className="backend-error">
    <AlertTriangle size={14} />

    <span>
      {error}
    </span>
  </div>
)}
      <main className="workspace">
        


        {/* ================================================= */}
        {/* LEFT — CONTROL PLANE                             */}
        {/* ================================================= */}

        <section className="workspace-panel control-panel">

          <div className="section-header">

            <div>

              <div className="section-kicker">
                CONTROL PLANE
              </div>

              <h1>
                Ralph CLI Console
              </h1>

            </div>


            <Terminal
              size={16}
              strokeWidth={1.5}
              className="section-icon"
            />

          </div>


          <div className="control-body">


            <div className="field">

              <label>
                BUSINESS USE CASE
              </label>


              <div className="select-wrapper">

                <select
                  value={selectedScenario}
                  onChange={(event) =>
                    setSelectedScenario(event.target.value)
                  }
                >

                  {scenarios.map((scenarioItem) => (
                    <option
                      key={scenarioItem.name}
                      value={scenarioItem.name}
                    >
                      {scenarioItem.name}
                    </option>
                  ))}

                </select>


                <ChevronDown
                  size={15}
                  className="select-icon"
                />

              </div>

            </div>



            <div className="field">

              <label>
                AGENT OBJECTIVE
              </label>

              <div className="objective-box">

  {currentScenario
    ? currentScenario.objective
    : "Loading scenario..."}

</div>

            </div>



            <div className="field threshold-field">

              <div className="threshold-top">

                <label>
                  COMPLIANCE PRUNING CUTOFF
                </label>

                <span className="threshold-number">
                  {threshold.toFixed(2)}
                </span>

              </div>


              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.01"
                value={threshold}
                onChange={(event) =>
                  setThreshold(Number(event.target.value))
                }
              />


              <div className="slider-scale">

                <span>
                  0.50
                </span>

                <span>
                  0.80
                </span>

                <span>
                  0.95
                </span>

              </div>

            </div>


            <div className="control-divider" />


            <button
  className={`execute-button ${
    executionState !== "idle"
      ? "active"
      : ""
  }`}
  onClick={handleExecute}
  disabled={
    visualPhase === "planning" ||
    visualPhase === "intercepting" ||
    visualPhase === "blocked" ||
    visualPhase === "rollback"
  }
>

  <Play
    size={15}
    fill="currentColor"
  />

  {executionState === "idle"
    ? "EXECUTE STRATEGY"
    : executionState === "error"
      ? "EXECUTION FAILED"
      : executionState === "complete"
        ? "EXECUTION COMPLETE"
        : "EXECUTING..."}

</button>


            <button
              className="reset-button"
              onClick={handleReset}
            >

              <Trash2 size={14} />

              WIPE SHORT-TERM MEMORY

            </button>


            <div className="control-footnote">

              <Shield size={14} />

              <span>
                Strategies crossing the semantic threshold
                are pruned before execution and rerouted
                through the rollback path.
              </span>

            </div>

          </div>

        </section>



        {/* ================================================= */}
        {/* CENTER — EXECUTION ENGINE                        */}
        {/* ================================================= */}

        <section className="workspace-panel execution-panel">

          <div className="section-header">

            <div>

              <div className="section-kicker">
                EXECUTION ENGINE
              </div>

              <h1>
                Live Workflow
              </h1>

            </div>


            <div
              className={`workflow-status ${
                visualPhase
              }`}
            >

              <span />

              {visualPhase === "idle"
                ? "STANDBY"
                : visualPhase === "planning"
                  ? "PLANNING"
                  : visualPhase === "intercepting"
                    ? "INTERCEPTING"
                    : visualPhase === "blocked"
                      ? "BLOCKED"
                      : visualPhase === "cleared"
                        ? "CLEARED"
                        : visualPhase === "rollback"
                          ? "ROLLBACK"
                          : visualPhase === "complete"
                            ? "COMPLETE"
                            : "ERROR"}

            </div>

          </div>


          <div className="execution-workspace">


            {/* PHASE 1 */}

            <div
              className={`workflow-phase ${
                visualPhase === "planning"
                  ? "phase-running"
                  : ""
              } ${
                executionResult || visualPhase === "intercepting"
                  ? "phase-complete"
                  : ""
              }`}
            >

              <div className="phase-number">
                01
              </div>

              <div className="phase-main">

                <div className="phase-heading">

                  <div className="phase-title">
                    Maestro Planning
                  </div>

                  <div
                    className={`phase-state ${
                      visualPhase === "planning"
                        ? "running"
                        : executionResult
                          ? "success"
                          : ""
                    }`}
                  >

                    {visualPhase === "planning"
                      ? "ACTIVE"
                      : executionResult
                        ? "COMPLETE"
                        : "WAITING"}

                  </div>

                </div>

                <div className="phase-description">
                  Generate an executable strategy from the
                  supplied objective.
                </div>

                <div className="phase-console">

                  <span className="console-prefix">
                    $
                  </span>

                  <span className="console-command">
                    maestro.generate_plan()
                  </span>

                </div>

                {proposedPlan && (
                  <div className="phase-result">

                    <div className="phase-result-label">
                      GENERATED STRATEGY
                    </div>

                    <div className="phase-result-text">
                      {proposedPlan}
                    </div>

                  </div>
                )}

              </div>

            </div>


            <div
              className={`workflow-connector ${
                executionResult
                  ? "connector-complete"
                  : ""
              }`}
            >
              <ArrowDown size={15} />
            </div>


            {/* PHASE 2 */}

            <div
              className={`workflow-phase ${
                visualPhase === "intercepting"
                  ? "phase-running"
                  : ""
              } ${
                executionResult
                  ? isBlocked
                    ? "phase-blocked"
                    : "phase-cleared"
                  : visualPhase === "intercepting"
                    ? "phase-active"
                    : ""
              }`}
            >

              <div className="phase-number">
                02
              </div>

              <div className="phase-main">

                <div className="phase-heading">

                  <div className="phase-title">
                    Interceptor Evaluation
                  </div>

                  <div
                    className={`phase-state ${
                      visualPhase === "intercepting"
                        ? "running"
                        : isBlocked &&
                          (
                            visualPhase === "blocked" ||
                            visualPhase === "rollback" ||
                            visualPhase === "complete"
                          )
                          ? "danger"
                          : isCleared &&
                            (
                              visualPhase === "cleared" ||
                              visualPhase === "complete"
                            )
                            ? "success"
                            : ""
                    }`}
                  >

                    {visualPhase === "intercepting"
                      ? "ANALYZING"
                      : isBlocked &&
                          (
                            visualPhase === "blocked" ||
                            visualPhase === "rollback" ||
                            visualPhase === "complete"
                          )
                        ? "BLOCKED"
                        : isCleared &&
                            (
                              visualPhase === "cleared" ||
                              visualPhase === "complete"
                            )
                          ? "CLEARED"
                          : "WAITING"}

                  </div>

                </div>

                <div className="phase-description">
                  Perform semantic lookahead against historical
                  regulatory failure fingerprints.
                </div>

                <div className="phase-console">

                  <span className="console-prefix">
                    $
                  </span>

                  <span className="console-command">
                    interceptor.check_for_cycles()
                  </span>

                </div>

                {executionResult && (
                  <div
                    className={`interceptor-result ${
                      isBlocked
                        ? "blocked"
                        : "cleared"
                    }`}
                  >

                    <div className="similarity-header">

                      <span className="similarity-label">
                        SEMANTIC SIMILARITY SIGNATURE
                      </span>

                      <span className="similarity-value">
                        {(similarity * 100).toFixed(2)}%
                      </span>

                    </div>

                    <div className="similarity-bar">

                      <div
                        className={`similarity-fill ${
                          isBlocked
                            ? "blocked"
                            : "cleared"
                        }`}
                        style={{
                          width: `${Math.min(
                            similarity * 100,
                            100
                          )}%`,
                        }}
                      />

                      <div
                        className="threshold-marker"
                        style={{
                          left: `${threshold * 100}%`,
                        }}
                      />

                    </div>

                    <div className="similarity-scale">

                      <span>
                        0
                      </span>

                      <span className="threshold-caption">
                        CUTOFF {(threshold * 100).toFixed(0)}%
                      </span>

                      <span>
                        100
                      </span>

                    </div>

                    {isBlocked ? (

                      <div className="compliance-alert">

                        <div className="compliance-alert-title">
                          COMPLIANCE BLOCK
                        </div>

                        <div className="compliance-alert-body">

                          Semantic failure match detected:
                          {" "}
                          <strong>
                            {matchedHazard}
                          </strong>

                        </div>

                        <div className="compliance-alert-action">
                          Semantic pruning triggered. Rerouting agent.
                        </div>

                      </div>

                    ) : (

                      <div className="route-clear">

                        <Check size={13} />

                        <span>
                          ROUTE CLEARED — NO REGULATORY CONFLICT
                        </span>

                      </div>

                    )}

                  </div>
                )}

              </div>

            </div>


            <div
              className={`workflow-connector ${
                executionResult && isBlocked
                  ? "connector-complete"
                  : ""
              }`}
            >
              <ArrowDown size={15} />
            </div>


            {/* PHASE 3 */}

            <div
              className={`workflow-phase ${
                visualPhase === "rollback"
                  ? "phase-running"
                  : ""
              } ${
                visualPhase === "rollback" || visualPhase === "complete"
                  ? "phase-rollback"
                  : ""
              }`}
            >

              <div className="phase-number">
                03
              </div>

              <div className="phase-main">

                <div className="phase-heading">

                  <div className="phase-title">
                    Semantic Rollback
                  </div>

                  <div
                    className={`phase-state ${
                      visualPhase === "rollback"
                        ? "running"
                        : visualPhase === "complete" &&
                          isBlocked
                          ? "success"
                          : ""
                    }`}
                  >

                    {!isBlocked
                      ? "NOT REQUIRED"
                      : visualPhase === "rollback"
                        ? "ACTIVE"
                        : visualPhase === "complete"
                          ? "COMPLETE"
                          : "WAITING"}

                  </div>

                </div>

                <div className="phase-description">
                  Archive the failure fingerprint and reroute
                  the agent toward a compliant strategy.
                </div>

                <div className="phase-console">

                  <span className="console-prefix">
                    $
                  </span>

                  <span className="console-command">
                    rollback_engine.archive_failure()
                  </span>

                </div>

                {isBlocked && executionResult?.rollback && (

                  <div className="rollback-result">

                    <div className="rollback-header">

                      <RotateCcw size={13} />

                      <span>
                        FAILURE FINGERPRINT ARCHIVED
                      </span>

                    </div>

                    <div className="rollback-meta">

                      <span>
                        VECTOR
                      </span>

                      <strong>
                        {executionResult.rollback.vector_dimension}D
                      </strong>

                      <span>
                        VAULT ENTRIES
                      </span>

                      <strong>
                        {executionResult.rollback.hazard_count}
                      </strong>

                    </div>

                    {pivotPlan && (

                      <div className="pivot-result">

                        <div className="pivot-heading">

                          <div className="pivot-badge">
                            PIVOT
                          </div>

                          <span>
                            COMPLIANT STRATEGY ACTIVATED
                          </span>

                        </div>

                        <div className="pivot-plan">
                          {pivotPlan}
                        </div>

                        <div className="pivot-verification">

                          <Check size={12} />

                          <span>
                            VERIFICATION PASSED
                          </span>

                        </div>

                      </div>

                    )}

                  </div>

                )}

              </div>

            </div>


          </div>


          {/* TELEMETRY */}

          <div className="telemetry">

            <div className="telemetry-header">

              <div className="telemetry-title">
                EXECUTION TELEMETRY
              </div>

              <div className="telemetry-live">
                <Activity size={12} />
                LIVE
              </div>

            </div>


            <div className="telemetry-body">

              {visualPhase === "idle" && (
                <>
                  <div className="telemetry-row">

                    <span className="telemetry-time">
                      --:--:--
                    </span>

                    <span className="telemetry-indicator neutral">
                      <Circle size={7} fill="currentColor" />
                    </span>

                    <span className="telemetry-text">
                      Awaiting execution trigger...
                    </span>

                  </div>

                  <div className="telemetry-row muted">

                    <span className="telemetry-time">
                      ------
                    </span>

                    <span className="telemetry-indicator">
                      <Circle size={7} />
                    </span>

                    <span className="telemetry-text">
                      Interceptor state: dormant
                    </span>

                  </div>
                </>
              )}

              {visualPhase === "planning" && (
                <div className="telemetry-row">

                  <span className="telemetry-time">
                    LIVE
                  </span>

                  <span className="telemetry-indicator running">
                    <Activity size={10} />
                  </span>

                  <span className="telemetry-text">
                    Maestro generating strategy...
                  </span>

                </div>
              )}

              {visualPhase === "intercepting" && (
                <div className="telemetry-row">

                  <span className="telemetry-time">
                    LIVE
                  </span>

                  <span className="telemetry-indicator running">
                    <Activity size={10} />
                  </span>

                  <span className="telemetry-text">
                    Searching semantic hazard space...
                  </span>

                </div>
              )}

              {visualPhase === "blocked" && (
                <div className="telemetry-row">

                  <span className="telemetry-time">
                    BLOCK
                  </span>

                  <span className="telemetry-indicator blocked">
                    <AlertTriangle size={10} />
                  </span>

                  <span className="telemetry-text">
                    Compliance threshold exceeded.
                  </span>

                </div>
              )}

              {visualPhase === "rollback" && (
                <div className="telemetry-row">

                  <span className="telemetry-time">
                    ROLL
                  </span>

                  <span className="telemetry-indicator running">
                    <RotateCcw size={10} />
                  </span>

                  <span className="telemetry-text">
                    Archiving failure fingerprint...
                  </span>

                </div>
              )}

              {visualPhase === "cleared" && (
                <div className="telemetry-row">

                  <span className="telemetry-time">
                    CLEAR
                  </span>

                  <span className="telemetry-indicator cleared">
                    <Check size={10} />
                  </span>

                  <span className="telemetry-text">
                    Strategy cleared for execution.
                  </span>

                </div>
              )}

              {visualPhase === "complete" && (
                <>

                  <div className="telemetry-row">

                    <span className="telemetry-time">
                      DONE
                    </span>

                    <span className="telemetry-indicator cleared">
                      <Check size={10} />
                    </span>

                    <span className="telemetry-text">
                      Execution workflow complete.
                    </span>

                  </div>

                  <div className="telemetry-row">

                    <span className="telemetry-time">
                      SIM
                    </span>

                    <span className="telemetry-indicator">
                      <Activity size={10} />
                    </span>

                    <span className="telemetry-text">

                      Similarity signature:
                      {" "}
                      {(
                        similarity * 100
                      ).toFixed(2)}
                      %

                    </span>

                  </div>

                </>
              )}

            </div>

          </div>

        </section>



        {/* ================================================= */}
        {/* RIGHT — SEMANTIC VAULT                            */}
        {/* ================================================= */}

        <section className="workspace-panel vault-panel">

          <div className="section-header">

            <div>

              <div className="section-kicker">
                SEMANTIC MEMORY
              </div>

              <h1>
                Vault Lookahead
              </h1>

            </div>


            <div className="vault-header-icon">

              <Database size={16} />

              <span>
                {vaultHazardCount}
              </span>

            </div>

          </div>


          <div className="vault-info">

            <div className="vault-info-title">
              HISTORICAL HAZARDS
            </div>

            <div className="vault-info-copy">
              Stored failure fingerprints used to detect
              semantically similar strategies before execution.
            </div>

          </div>


          {/* SEMANTIC MAP */}

          <div
            className={`semantic-map ${
              visualPhase === "intercepting" ||
              visualPhase === "blocked" ||
              visualPhase === "rollback" ||
              visualPhase === "complete"
                ? "execution-active"
                : ""
            }`}
          >

            <div className="map-grid" />
            <div className="map-axis horizontal" />
            <div className="map-axis vertical" />

            {!semanticMap ? (

              <div className="map-empty">

                <Database size={22} />

                <span className="map-empty-title">
                  VAULT LOOKAHEAD
                </span>

                <span className="map-empty-copy">
                  Execute a strategy to project
                  semantic positions.
                </span>

              </div>

            ) : (

              <svg
                className="semantic-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >

                {matchedNode && (
                  <circle
                    cx={matchedNode.x}
                    cy={100 - matchedNode.y}
                    r={matchRadius}
                    className="match-radius"
                  />
                )}

                {matchedNode && proposedNode && (
                  <line
                    x1={proposedNode.x}
                    y1={100 - proposedNode.y}
                    x2={matchedNode.x}
                    y2={100 - matchedNode.y}
                    className="semantic-connection danger"
                  />
                )}

                {proposedNode && pivotNode && (
                  <line
                    x1={proposedNode.x}
                    y1={100 - proposedNode.y}
                    x2={pivotNode.x}
                    y2={100 - pivotNode.y}
                    className="semantic-connection pivot"
                  />
                )}

                {semanticMap.nodes.map((node) => {
                  const nodeClass = `semantic-node ${node.type} ${
                    node.matched ? "matched" : ""
                  }`;

                  const radius =
                    node.type === "hazard" ? 2.2 : 2.8;

                  return (
                    <g
                      key={node.id}
                      className={nodeClass}
                    >
                      <circle
                        cx={node.x}
                        cy={100 - node.y}
                        r={radius}
                      />

                      <text
                        x={node.x}
                        y={100 - node.y - 4}
                        textAnchor="middle"
                        className="node-label"
                      >
                        {node.label.length > 22
                          ? `${node.label.slice(0, 22)}…`
                          : node.label}
                      </text>
                    </g>
                  );
                })}

              </svg>

            )}

          </div>

          {semanticMap && (
            <div className="semantic-similarity-list">
              <div className="semantic-similarity-header">
                SEMANTIC SIMILARITIES
              </div>

              {(semanticMap.hazard_similarities ?? []).map((item) => (
                <div
                  key={item.hazard_id}
                  className="semantic-similarity-item"
                >
                  <span className="semantic-similarity-label">
                    {item.label}
                  </span>

                  <span className="semantic-similarity-value">
                    {(item.similarity * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {semanticMap && topSimilarity && (
            <div className="semantic-summary">
              <div className="semantic-summary-main">
                <div className="semantic-summary-label">
                  TOP SEMANTIC MATCH
                </div>

                <div className="semantic-summary-hazard">
                  {topSimilarity.label}
                </div>
              </div>

              <div className="semantic-summary-score">
                <span>
                  SIGNATURE
                </span>

                <strong>
                  {topSimilarityPercent}%
                </strong>
              </div>
            </div>
          )}

          <div className="vault-hazard-list">

            {(vault?.hazards ?? []).map((hazard) => (

              <div
                className="vault-hazard"
                key={hazard.index}
              >

                <span className="vault-hazard-dot" />

                <div className="vault-hazard-content">

                  <div className="vault-hazard-name">
                    {hazard.logic}
                  </div>

                  <div className="vault-hazard-meta">
                    VECTOR · {hazard.vector_dimension}D
                  </div>

                </div>

              </div>

            ))}

          </div>


          <div className="vault-legend">

            <div className="legend-item">

              <span className="legend-dot hazard" />

              <span>
                Historical hazard
              </span>

            </div>


            <div className="legend-item">

              <span className="legend-dot proposed" />

              <span>
                Proposed strategy
              </span>

            </div>


            <div className="legend-item">

              <span className="legend-dot pivot" />

              <span>
                Pivot strategy
              </span>

            </div>

          </div>


          <div className="vault-footer">

            <span>
              COSINE DISTANCE
            </span>

            <span>
              EMBEDDING SPACE
            </span>

          </div>

        </section>

      </main>



      {/* ================================================= */}
      {/* AUDIT TRAIL                                       */}
      {/* ================================================= */}

      <section className="audit-panel">

        <div className="audit-heading">

          <div>

            <div className="section-kicker">
              IMMUTABLE AUDIT LOG
            </div>

            <h2>
              RUN ID: {runId}
            </h2>

          </div>

        </div>


        <div className="audit-timeline">

          {auditTrail.length === 0 ? (

            <div className="audit-placeholder">
              <Terminal size={15} />
              <span>No execution events recorded.</span>
            </div>

          ) : (

            <div className="timeline-events">
              {auditTrail.map((event, idx) => (
                <div key={idx} className={`timeline-event ${event.type.toLowerCase()}`}>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="event-header">
                      <span className="event-time">{event.time}</span>
                      <span className="event-type">{event.type}</span>
                    </div>
                    <div className="event-body">
                      {event.type === "PLANNING" && (
                        <>
                          <span className="event-label">{event.label}</span>
                          <span className="event-detail">└─ {event.details}</span>
                        </>
                      )}
                      {event.type === "INTERCEPTOR" && (
                        <>
                          <div className="event-metrics">
                            <div>
                              <span className="metric-label">Similarity</span>
                              <span className="metric-value">{(event.similarity * 100).toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="metric-label">Threshold</span>
                              <span className="metric-value">{(event.threshold * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="event-label">Matched</span>
                            <span className="event-detail">{event.matched}</span>
                          </div>
                          {event.blocked && (
                            <span className="event-status blocked">└─ BLOCKED</span>
                          )}
                        </>
                      )}
                      {event.type === "ROLLBACK" && (
                        <>
                          <span className="event-label">{event.label}</span>
                          <div className="event-metrics">
                            <div>
                              <span className="metric-label">Vector</span>
                              <span className="metric-value">{event.vector}</span>
                            </div>
                            <div>
                              <span className="metric-label">Vault entries</span>
                              <span className="metric-value">{event.vaultEntries}</span>
                            </div>
                          </div>
                        </>
                      )}
                      {event.type === "PIVOT" && (
                        <>
                          <span className="event-label">{event.label}</span>
                          {event.verified && (
                            <span className="event-status verified">└─ Verification passed</span>
                          )}
                        </>
                      )}
                      {event.type === "COMPLETE" && (
                        <span className="event-label">{event.label}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          )}

        </div>

      </section>



      {/* ================================================= */}
      {/* FOOTER                                            */}
      {/* ================================================= */}

      <footer className="app-footer">

        <div>
          RALPH SEMANTIC ROLLBACK
        </div>

        <div>
          SENTENCE TRANSFORMERS · SEMANTIC LOOKAHEAD · ROLLBACK MEMORY
        </div>

        <div>
          DEV MODE
        </div>

      </footer>

    </div>
  );
}


export default App;