import { useState, useEffect } from "react";
import "./App.css";

function App() {
  // ========== Language Configuration State ==========
  const [patternType, setPatternType] = useState("equal-counts");
  const [symbolsInput, setSymbolsInput] = useState("a b");
  const [customSymbols, setCustomSymbols] = useState(["a", "b"]);
  const [customConstraints, setCustomConstraints] = useState({
    palinLengthType: "any",
    repetitionBlock: "ab",
  });

  // ========== Core Pumping State ==========
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [u, setU] = useState("");
  const [v, setV] = useState("");
  const [w, setW] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [i, setI] = useState(1);

  // ========== History with localStorage ==========
  const [attempts, setAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem("pumpingLemmaAttempts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentResult, setCurrentResult] = useState(null);
  const [activeTab, setActiveTab] = useState("explore");

  // Save attempts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pumpingLemmaAttempts", JSON.stringify(attempts));
    } catch {
      // Silently fail
    }
  }, [attempts]);

  // Parse symbols input string into array whenever it changes
  useEffect(() => {
    const parsed = symbolsInput
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0);
    if (parsed.length >= 1) {
      setCustomSymbols(parsed);
    }
  }, [symbolsInput]);

  // ========== Language Builder ==========
  const buildLanguage = () => {
    if (patternType === "equal-counts") {
      const symbols = customSymbols;
      if (!symbols || symbols.length === 0) {
        return {
          description: "Please enter at least one symbol",
          validate: () => ({ valid: false, error: "No symbols defined" }),
          check: () => ({ valid: false, reason: "No symbols" }),
        };
      }

      const symList = symbols.map((s) => `${s}^n`).join(" ");
      return {
        description: `L = { ${symList} | n ≥ 1 }`,
        validate: (str) => {
          if (!str || str.length === 0)
            return { valid: false, error: "String cannot be empty" };

          // Build counts
          const counts = {};
          for (const sym of symbols) {
            counts[sym] = 0;
          }
          for (const ch of str) {
            if (!counts.hasOwnProperty(ch)) {
              return { valid: false, error: `Character '${ch}' not in symbol set: ${symbols.join(", ")}` };
            }
            counts[ch]++;
          }

          // Verify ordering: all occurrences of symbols[i] come before symbols[i+1]
          for (let si = 0; si < symbols.length - 1; si++) {
            const lastCurrent = str.lastIndexOf(symbols[si]);
            const firstNext = str.indexOf(symbols[si + 1]);
            if (firstNext !== -1 && lastCurrent > firstNext) {
              return { valid: false, error: `Symbols out of order: '${symbols[si]}' appears after '${symbols[si + 1]}'` };
            }
          }

          // Check all counts are equal and > 0
          const values = Object.values(counts);
          if (values.some((v) => v === 0)) {
            const missing = symbols.filter((s) => counts[s] === 0);
            return { valid: false, error: `Missing symbols: ${missing.join(", ")}` };
          }
          const allEqual = values.every((v) => v === values[0]);
          if (!allEqual) {
            return {
              valid: false,
              error: `Not all counts equal: ${Object.entries(counts)
                .map(([s, c]) => `${s}=${c}`)
                .join(", ")}`,
            };
          }
          return { valid: true, counts };
        },
        check: (str) => {
          const counts = {};
          for (const sym of symbols) counts[sym] = 0;
          for (const ch of str) {
            if (counts.hasOwnProperty(ch)) counts[ch]++;
          }
          const values = Object.values(counts);
          const allEqual = values.every((v) => v === values[0]) && values[0] > 0;
          return {
            valid: allEqual,
            reason: allEqual
              ? `${Object.entries(counts).map(([s, c]) => `${c} ${s}'s`).join(", ")}: all equal ✓`
              : `${Object.entries(counts).map(([s, c]) => `${c} ${s}'s`).join(", ")}: not equal ✗`,
            counts,
          };
        },
      };
    }

    if (patternType === "paired-counts") {
      // First symbol count = product of rest (mirror/nesting pattern)
      const symbols = customSymbols;
      return {
        description: `L = { ${symbols[0]}^n ${(symbols[1] || "b")}^n | n ≥ 1 } (nested/paired)`,
        validate: (str) => {
          if (!str || str.length === 0) return { valid: false, error: "String cannot be empty" };
          const s1 = symbols[0] || "a";
          const s2 = symbols[1] || "b";
          const c1 = (str.match(new RegExp(s1, "g")) || []).length;
          const c2 = (str.match(new RegExp(s2, "g")) || []).length;
          if (c1 !== c2 || c1 === 0) return { valid: false, error: `${s1} count (${c1}) ≠ ${s2} count (${c2})` };
          return { valid: true, counts: { [s1]: c1, [s2]: c2 } };
        },
        check: (str) => {
          const s1 = symbols[0] || "a";
          const s2 = symbols[1] || "b";
          const c1 = (str.match(new RegExp(s1, "g")) || []).length;
          const c2 = (str.match(new RegExp(s2, "g")) || []).length;
          const isValid = c1 === c2 && c1 > 0;
          return {
            valid: isValid,
            reason: isValid ? `${c1} ${s1}'s = ${c2} ${s2}'s ✓` : `${c1} ${s1}'s ≠ ${c2} ${s2}'s ✗`,
            counts: { [s1]: c1, [s2]: c2 },
          };
        },
      };
    }

    if (patternType === "mirror") {
      return {
        description: `L = { ww | w ∈ Σ* } (string repeated twice)`,
        validate: (str) => {
          if (!str || str.length === 0) return { valid: false, error: "String cannot be empty" };
          if (str.length % 2 !== 0) return { valid: false, error: `Length ${str.length} is odd; must be even for ww pattern` };
          const half = str.length / 2;
          const w1 = str.slice(0, half);
          const w2 = str.slice(half);
          if (w1 !== w2) return { valid: false, error: `First half "${w1}" ≠ second half "${w2}"` };
          return { valid: true, counts: {} };
        },
        check: (str) => {
          if (str.length % 2 !== 0) return { valid: false, reason: `Odd length (${str.length}) ✗`, counts: {} };
          const half = str.length / 2;
          const w1 = str.slice(0, half);
          const w2 = str.slice(half);
          const isValid = w1 === w2;
          return {
            valid: isValid,
            reason: isValid ? `"${w1}" repeated twice ✓` : `"${w1}" ≠ "${w2}" ✗`,
            counts: {},
          };
        },
      };
    }

    if (patternType === "palindrome") {
      const lenType = customConstraints.palinLengthType;
      return {
        description: `L = { w | w is a ${lenType === "even-only" ? "even-length " : lenType === "odd-only" ? "odd-length " : ""}palindrome }`,
        validate: (str) => {
          if (!str || str.length === 0) return { valid: false, error: "String cannot be empty" };
          const rev = str.split("").reverse().join("");
          if (str !== rev) return { valid: false, error: "String is not a palindrome" };
          if (lenType === "even-only" && str.length % 2 !== 0)
            return { valid: false, error: `Must be even length (got ${str.length})` };
          if (lenType === "odd-only" && str.length % 2 !== 1)
            return { valid: false, error: `Must be odd length (got ${str.length})` };
          return { valid: true, counts: {} };
        },
        check: (str) => {
          const rev = str.split("").reverse().join("");
          const isPalin = str === rev;
          let typeOk = true;
          let typeMsg = ` (length ${str.length})`;
          if (lenType === "even-only") {
            typeOk = str.length % 2 === 0;
            typeMsg = typeOk ? ` even length (${str.length})` : ` not even length (${str.length})`;
          } else if (lenType === "odd-only") {
            typeOk = str.length % 2 === 1;
            typeMsg = typeOk ? ` odd length (${str.length})` : ` not odd length (${str.length})`;
          }
          const valid = isPalin && typeOk;
          return {
            valid,
            reason: valid ? `Palindrome${typeMsg} ✓` : !isPalin ? `Not a palindrome ✗` : `Length constraint failed${typeMsg} ✗`,
            counts: {},
            mirrorAnalysis: { isPalin, original: str, reversed: rev },
          };
        },
      };
    }

    if (patternType === "repetition") {
      const block = customConstraints.repetitionBlock;
      return {
        description: `L = { (${block})^n | n ≥ 1 }`,
        validate: (str) => {
          if (!block || block.length === 0) return { valid: false, error: "Block pattern not defined" };
          if (!str || str.length === 0) return { valid: false, error: "String cannot be empty" };
          if (str.length % block.length !== 0)
            return { valid: false, error: `Length ${str.length} not divisible by block length ${block.length}` };
          const reps = str.length / block.length;
          if (str !== block.repeat(reps)) return { valid: false, error: `Not ${reps} repetitions of "${block}"` };
          return { valid: true, counts: {} };
        },
        check: (str) => {
          if (!block || block.length === 0) return { valid: false, reason: "No block defined ✗", counts: {} };
          const reps = str.length / block.length;
          const isValid = str === block.repeat(reps);
          return {
            valid: isValid,
            reason: isValid ? `${reps} repetitions of "${block}" ✓` : `Not repetitions of "${block}" ✗`,
            counts: {},
          };
        },
      };
    }

    return {
      description: "L = { ... }",
      validate: () => ({ valid: false, error: "Pattern type not supported" }),
      check: () => ({ valid: false, reason: "Error" }),
    };
  };

  // ========== Get Current Language ==========
  const getCurrentLanguage = () => buildLanguage();

  // ========== Validate Input String ==========
  const validateInput = () => {
    if (!input.trim()) {
      setInputError("Input string cannot be empty");
      return false;
    }
    const language = getCurrentLanguage();
    const result = language.validate(input);
    if (!result.valid) {
      setInputError("Not in language: " + result.error);
      return false;
    }
    setInputError("");
    return true;
  };

  // ========== Validate Decomposition ==========
  const validateDecomposition = () => {
    const errors = [];
    if (u + v + w + x + y !== input) errors.push("u + v + w + x + y ≠ input string");
    if (v.length + x.length === 0) errors.push("|vx| = 0 (at least one of v or x must be non-empty)");
    const vwxLen = v.length + w.length + x.length;
    if (vwxLen > 6) errors.push(`|vwx| = ${vwxLen} > 6`);
    return { valid: errors.length === 0, errors };
  };

  // ========== Check if pump button should be disabled ==========
  const isDecompValid =
    input.length > 0 &&
    u + v + w + x + y === input &&
    v.length + x.length > 0 &&
    v.length + w.length + x.length <= 6;

  // ========== Handle Pump ==========
  const handlePump = () => {
    if (!validateInput()) return;

    const decompositionVal = validateDecomposition();
    if (!decompositionVal.valid) {
      setCurrentResult({ attempt: null, error: decompositionVal.errors.join("; ") });
      return;
    }

    const pumped = u + v.repeat(i) + w + x.repeat(i) + y;
    const language = getCurrentLanguage();
    const checkResult = language.check(pumped);

    const attempt = {
      id: Date.now(),
      input,
      u, v, w, x, y,
      i,
      pumped,
      inLanguage: checkResult.valid,
      reason: checkResult.reason,
      counts: checkResult.counts,
      mirrorAnalysis: checkResult.mirrorAnalysis,
      timestamp: new Date().toLocaleTimeString(),
    };

    setAttempts([attempt, ...attempts]);
    setCurrentResult({ attempt, error: null });
    // NOTE: Inputs are intentionally NOT cleared here (fix #2)
  };

  // ========== Handle Clear ==========
  const handleClear = () => {
    setU("");
    setV("");
    setW("");
    setX("");
    setY("");
    setI(1);
    setInput("");
    setInputError("");
    setCurrentResult(null);
  };

  // ========== Generate Explanation ==========
  const generateExplanation = (attempt) => {
    const decompositionDisplay = (
      <div className="decomp-display">
        {[
          { key: "u", val: attempt.u, color: "#FFB3BA" },
          { key: "v", val: attempt.v, color: "#FFCAB3" },
          { key: "w", val: attempt.w, color: "#FFFFBA" },
          { key: "x", val: attempt.x, color: "#BAE1BA" },
          { key: "y", val: attempt.y, color: "#BAD7F2" },
        ].map(({ key, val, color }) => (
          <div key={key} className="decomp-display-item">
            <span className="decomp-display-label" style={{ background: color }}>{key}</span>
            <span className="decomp-display-val">{val || "ε"}</span>
          </div>
        ))}
      </div>
    );

    if (!attempt.inLanguage) {
      return (
        <div className="explanation-box violation">
          <p className="explanation-icon">✓</p>
          <p className="explanation-title">Violation Found!</p>

          <div className="guided-section">
            <div className="comparison-row">
              <div className="comparison-item">
                <p className="comparison-label">Original String:</p>
                <p className="comparison-value">{attempt.input}</p>
              </div>
              <p className="comparison-arrow">→</p>
              <div className="comparison-item">
                <p className="comparison-label">Pumped (i={attempt.i}):</p>
                <p className="comparison-value pumped-highlight">{attempt.pumped}</p>
              </div>
            </div>
          </div>

          {decompositionDisplay}

          {attempt.mirrorAnalysis && (
            <div className="mirror-visualization">
              <p className="visualization-label">Palindrome Analysis:</p>
              <div className="mirror-comparison">
                <div className="mirror-row">
                  <span className="mirror-label">Original:</span>
                  <div className="mirror-chars">
                    {attempt.input?.split("").map((char, idx) => (
                      <span key={idx} className="mirror-char">{char}</span>
                    ))}
                  </div>
                </div>
                <div className="mirror-row">
                  <span className="mirror-label">Pumped:</span>
                  <div className="mirror-chars">
                    {attempt.pumped?.split("").map((char, idx) => (
                      <span key={idx} className="mirror-char">{char}</span>
                    ))}
                  </div>
                </div>
                <div className="mirror-row">
                  <span className="mirror-label">Reversed:</span>
                  <div className="mirror-chars">
                    {attempt.pumped?.split("").reverse().map((char, idx) => (
                      <span key={idx} className={`mirror-char ${attempt.pumped === attempt.pumped.split("").reverse().join("") ? "match" : "mismatch"}`}>{char}</span>
                    ))}
                  </div>
                </div>
              </div>
              {!attempt.mirrorAnalysis.isPalin && <p className="mismatch-highlight">Not symmetric ✗</p>}
            </div>
          )}

          {Object.keys(attempt.counts || {}).length > 0 && (
            <div className="counts-breakdown">
              <p className="breakdown-label">Character Counts After Pumping:</p>
              <div className="counts-grid">
                {Object.entries(attempt.counts).map(([char, count]) => (
                  <div key={char} className="count-item">
                    <span className="count-char">{char}:</span>
                    <span className="count-value">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="analysis-section">
            <p className="analysis-label">Analysis:</p>
            <p className="analysis-reason">{attempt.reason}</p>
          </div>

          <div className="evidence-banner">
            <p><strong>Finding:</strong> This pumped string does NOT satisfy the language condition. This provides evidence that the language may not be context-free.</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="explanation-box no-violation">
          <p className="explanation-icon">✗</p>
          <p className="explanation-title">No Violation Found</p>

          <div className="guided-section">
            <div className="comparison-row">
              <div className="comparison-item">
                <p className="comparison-label">Original String:</p>
                <p className="comparison-value">{attempt.input}</p>
              </div>
              <p className="comparison-arrow">→</p>
              <div className="comparison-item">
                <p className="comparison-label">Pumped (i={attempt.i}):</p>
                <p className="comparison-value">{attempt.pumped}</p>
              </div>
            </div>
          </div>

          {decompositionDisplay}

          {attempt.mirrorAnalysis && attempt.mirrorAnalysis.isPalin && (
            <div className="mirror-visualization">
              <p className="visualization-label">Palindrome Analysis:</p>
              <div className="mirror-comparison">
                <div className="mirror-row">
                  <span className="mirror-label">Pumped:</span>
                  <div className="mirror-chars">
                    {attempt.pumped?.split("").map((char, idx) => (
                      <span key={idx} className="mirror-char match">{char}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="match-highlight">Is symmetric ✓</p>
            </div>
          )}

          {Object.keys(attempt.counts || {}).length > 0 && (
            <div className="counts-breakdown">
              <p className="breakdown-label">Character Counts After Pumping:</p>
              <div className="counts-grid">
                {Object.entries(attempt.counts).map(([char, count]) => (
                  <div key={char} className="count-item">
                    <span className="count-char">{char}:</span>
                    <span className="count-value">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="analysis-section">
            <p className="analysis-label">Analysis:</p>
            <p className="analysis-reason">{attempt.reason}</p>
          </div>

          <div className="notice-banner">
            <p><strong>Finding:</strong> This pumped string still satisfies the language condition. No violation found. Try other decompositions or strings.</p>
          </div>
        </div>
      );
    }
  };

  // ========== Analysis Data ==========
  const analysisData = {
    total: attempts.length,
    violations: attempts.filter((a) => !a.inLanguage).length,
    valid: attempts.filter((a) => a.inLanguage).length,
  };

  // ========== Clear History ==========
  const clearHistory = () => {
    setAttempts([]);
    setCurrentResult(null);
  };

  const lang = getCurrentLanguage();
  const decompConcat = u + v + w + x + y;
  const decompMatchesInput = decompConcat === input;

  // ========== Render ==========
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="title">CFL Pumping Lemma Simulator</h1>
          <p className="subtitle">Explore context-free language properties through pumping with input validation</p>
        </div>
      </header>

      <div className="layout-container">
        {/* ========== LEFT PANEL ==========  */}
        <aside className="left-panel">

          {/* ── Language Configuration ── */}
          <section className="card">
            <h2 className="card-title">Language Configuration</h2>

            {/* Pattern Type Buttons */}
            <p className="field-label">Pattern Type:</p>
            <div className="pattern-buttons">
              {[
                { value: "equal-counts", label: "Equal Counts" },
                { value: "paired-counts", label: "Paired Counts" },
                { value: "mirror", label: "Mirror Pattern" },
                { value: "palindrome", label: "Palindrome" },
                { value: "repetition", label: "Repetition" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`pattern-btn ${patternType === opt.value ? "active" : ""}`}
                  onClick={() => setPatternType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Symbols input — only for relevant pattern types */}
            {(patternType === "equal-counts" || patternType === "paired-counts") && (
              <div className="field-group">
                <label className="field-label">Symbols (space-separated):</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g., a b c d"
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value)}
                />
                {customSymbols.length > 0 && (
                  <p className="field-hint">
                    Parsed: {customSymbols.map((s) => <code key={s} style={{ marginRight: 4 }}>{s}</code>)}
                  </p>
                )}
              </div>
            )}

            {/* Palindrome length type */}
            {patternType === "palindrome" && (
              <div className="field-group">
                <p className="field-label">Length Constraint:</p>
                <div className="sub-buttons">
                  {[
                    { value: "any", label: "Any Length" },
                    { value: "even-only", label: "Even Only" },
                    { value: "odd-only", label: "Odd Only" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`pattern-btn ${customConstraints.palinLengthType === opt.value ? "active" : ""}`}
                      onClick={() => setCustomConstraints({ ...customConstraints, palinLengthType: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Repetition block */}
            {patternType === "repetition" && (
              <div className="field-group">
                <label className="field-label">Repetition Block:</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g., ab or aabb"
                  value={customConstraints.repetitionBlock}
                  onChange={(e) => setCustomConstraints({ ...customConstraints, repetitionBlock: e.target.value })}
                />
              </div>
            )}

            {/* Language definition display */}
            <div className="custom-display">
              <p className="field-label">Language Definition:</p>
              <p className="custom-lang-desc">{lang.description}</p>
            </div>
          </section>

          {/* ── Input String ── */}
          <section className="card">
            <h2 className="card-title">Input String</h2>
            <p className="field-hint">{lang.description}</p>
            <input
              type="text"
              className={`text-input ${inputError ? "error" : ""}`}
              placeholder="Enter a string that belongs to the selected language"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setInputError("");
              }}
            />
            {inputError && <p className="error-message">{inputError}</p>}
            {!inputError && input && <p className="field-hint">Length: {input.length}</p>}
          </section>

          {/* ── Decomposition ── */}
          <section className="card">
            <h2 className="card-title">Decomposition</h2>
            <p className="field-hint">Break your string into u | v | w | x | y (all five parts must concatenate to the input)</p>

            <div className="decomp-grid">
              {[
                { key: "u", value: u, setter: setU, color: "#FFB3BA" },
                { key: "v", value: v, setter: setV, color: "#FFCAB3" },
                { key: "w", value: w, setter: setW, color: "#FFFFBA" },
                { key: "x", value: x, setter: setX, color: "#BAE1BA" },
                { key: "y", value: y, setter: setY, color: "#BAD7F2" },
              ].map(({ key, value, setter, color }) => (
                <div key={key} className="decomp-item">
                  <label className="decomp-label" style={{ background: color }}>{key}</label>
                  <input
                    type="text"
                    className="decomp-input"
                    placeholder={key}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Inline concatenation preview */}
            {(u || v || w || x || y) && (
              <div className="decomp-preview">
                <span className="decomp-preview-label">Concat:</span>
                <span className={`decomp-preview-val ${decompMatchesInput ? "ok" : "fail"}`}>
                  {decompConcat || "—"}
                </span>
                {input && (
                  <span className={`decomp-match-badge ${decompMatchesInput ? "ok" : "fail"}`}>
                    {decompMatchesInput ? "✓ matches input" : "✗ doesn't match"}
                  </span>
                )}
              </div>
            )}

            {/* Validation Checks */}
            {(u || v || w || x || y) && (
              <div className="validation-checks">
                <div className="check-row">
                  <span>u+v+w+x+y = input</span>
                  {decompMatchesInput
                    ? <span className="check-ok">✓</span>
                    : <span className="check-fail">✗</span>}
                </div>
                <div className="check-row">
                  <span>|vx| &gt; 0 &nbsp;({v.length + x.length})</span>
                  {v.length + x.length > 0
                    ? <span className="check-ok">✓</span>
                    : <span className="check-fail">✗</span>}
                </div>
                <div className="check-row">
                  <span>|vwx| ≤ 6 &nbsp;({v.length + w.length + x.length})</span>
                  {v.length + w.length + x.length <= 6
                    ? <span className="check-ok">✓</span>
                    : <span className="check-fail">✗</span>}
                </div>
              </div>
            )}
          </section>

          {/* ── Pumping Count ── */}
          <section className="card">
            <h2 className="card-title">Pumping Count (i)</h2>
            <p className="field-hint">Any non-negative integer — controls how many times v and x are repeated</p>
            <input
              type="number"
              className="text-input"
              min="0"
              value={i}
              onChange={(e) => setI(Math.max(0, Number(e.target.value) || 0))}
            />
          </section>

          {/* ── Action Buttons ── */}
          <section className="card action-card">
            <button
              className="btn-primary"
              onClick={handlePump}
              disabled={!isDecompValid}
              title={!isDecompValid ? "Fix decomposition before pumping" : ""}
            >
              🚀 Test Pumping (i = {i})
            </button>
            <button className="btn-secondary" onClick={handleClear}>
              🗑 Clear All Inputs
            </button>
          </section>
        </aside>

        {/* ========== RIGHT PANEL ========== */}
        <main className="right-panel">
          <div className="results-tabs">
            <button className={`tab-btn ${activeTab === "explore" ? "active" : ""}`} onClick={() => setActiveTab("explore")}>
              Result & Analysis
            </button>
            <button className={`tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
              History ({attempts.length})
            </button>
            <button className={`tab-btn ${activeTab === "guide" ? "active" : ""}`} onClick={() => setActiveTab("guide")}>
              Guide
            </button>
          </div>

          {/* Result Tab */}
          {activeTab === "explore" && (
            <div className="tab-content">
              {currentResult && !currentResult.error ? (
                generateExplanation(currentResult.attempt)
              ) : currentResult?.error ? (
                <div className="error-card">
                  <p className="error-title">⚠️ Invalid Decomposition</p>
                  <p>{currentResult.error}</p>
                </div>
              ) : (
                <div className="empty-state">
                  <p className="empty-icon">🔍</p>
                  <p className="empty-text">
                    Enter a valid string, decompose it into u v w x y, and click <strong>Test Pumping</strong> to see the analysis.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="tab-content">
              {attempts.length > 0 ? (
                <>
                  <div className="history-header">
                    <button className="btn-clear" onClick={clearHistory}>Clear All</button>
                  </div>
                  <div className="attempts-list">
                    {attempts.map((attempt) => (
                      <div key={attempt.id} className={`attempt-item ${!attempt.inLanguage ? "violation" : "valid"}`}>
                        <div className="attempt-header">
                          <span className="attempt-status">
                            {!attempt.inLanguage ? "✓ Violation Found" : "✗ No Violation"}
                          </span>
                          <span className="attempt-time">{attempt.timestamp}</span>
                        </div>
                        <div className="attempt-content">
                          <p><strong>{attempt.input}</strong> → <em>{attempt.pumped}</em> (i={attempt.i})</p>
                          <p style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: "0.85em" }}>
                            u="{attempt.u}" v="{attempt.v}" w="{attempt.w}" x="{attempt.x}" y="{attempt.y}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p className="empty-icon">📋</p>
                  <p className="empty-text">No attempts yet. History persists across page refreshes.</p>
                </div>
              )}
            </div>
          )}

          {/* Guide Tab */}
          {activeTab === "guide" && (
            <div className="tab-content">
              <div className="guide-container">
                <h3 className="guide-title">About the CFL Pumping Lemma</h3>

                <div className="guide-section">
                  <h4>What is the Pumping Lemma?</h4>
                  <p>
                    The Pumping Lemma is a necessary condition for context-free languages (CFLs). It states that for any CFL L, there exists a pumping length p such that any string z ∈ L with |z| ≥ p can be decomposed as z = uvwxy with:
                  </p>
                  <ul>
                    <li>|vwx| ≤ p</li>
                    <li>|vx| &gt; 0 (at least one of v or x must be non-empty)</li>
                    <li>For all i ≥ 0, uv<sup>i</sup>wx<sup>i</sup>y ∈ L</li>
                  </ul>
                </div>

                <div className="guide-section">
                  <h4>How to Find Counterexamples</h4>
                  <p>
                    If you find even ONE decomposition where pumping (for any i ≥ 0) creates a string NOT in the language, you've proven it is NOT context-free.
                  </p>
                  <p style={{ marginTop: "12px", fontWeight: "600" }}>
                    The key: find a string where no valid decomposition survives all pumping values.
                  </p>
                </div>

                <div className="guide-section">
                  <h4>Pattern Types Available</h4>
                  <ul>
                    <li><strong>Equal Counts</strong> — e.g. aⁿbⁿcⁿ; each symbol appears the same number of times in order.</li>
                    <li><strong>Paired Counts</strong> — e.g. aⁿbⁿ; two symbols with equal counts.</li>
                    <li><strong>Mirror Pattern</strong> — strings of the form ww (repeated twice).</li>
                    <li><strong>Palindrome</strong> — strings that read the same forwards and backwards.</li>
                    <li><strong>Repetition</strong> — repeated copies of a fixed block, e.g. (ab)ⁿ.</li>
                  </ul>
                </div>

                <div className="guide-section">
                  <h4>What If All Tests Pass?</h4>
                  <p>
                    Passing all tests doesn't prove a language IS context-free — it only means you haven't found a counterexample yet. The language might still be non-CFL.
                  </p>
                </div>

                <div className="stats-container">
                  <h4>Session Statistics</h4>
                  <div className="stats-grid">
                    <div className="stat-box">
                      <span className="stat-number">{analysisData.total}</span>
                      <span className="stat-label">Tests</span>
                    </div>
                    <div className="stat-box violation">
                      <span className="stat-number">{analysisData.violations}</span>
                      <span className="stat-label">Violations</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-number">{analysisData.valid}</span>
                      <span className="stat-label">No Violation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>📚 CFL Pumping Lemma Simulator | Theory of Computation Educational Tool</p>
      </footer>
    </div>
  );
}

export default App;