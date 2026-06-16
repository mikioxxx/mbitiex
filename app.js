let attributes = {};
let mbtiCatalog = [];
let mbtiTypeProfiles = {};
let questions = [];
let subtypeCopy = {};
let contrastCopy = {};
let generatedSubtypeMap = {};
let copyTemplates = {};
let currentMbti = "INFP";
const publicSiteUrl = "https://mikioxxx.github.io/mbitiex/";

async function loadAppData() {
  const [config, profiles, overrides, templates] = await Promise.all([
    fetch("data/app-config.json").then((response) => response.json()),
    fetch("data/mbti-profiles.json").then((response) => response.json()),
    fetch("data/subtype-overrides.json").then((response) => response.json()),
    fetch("data/copy-templates.json").then((response) => response.json())
  ]);
  attributes = config.attributes;
  mbtiCatalog = config.mbtiCatalog;
  questions = config.questions;
  mbtiTypeProfiles = profiles;
  generatedSubtypeMap = overrides;
  subtypeCopy = templates.subtypeCopy;
  contrastCopy = templates.contrastCopy;
  copyTemplates = templates;
}

const state = {
      index: 0,
      answers: []
    };

    const startScreen = document.getElementById("startScreen");
    const quizScreen = document.getElementById("quizScreen");
    const resultScreen = document.getElementById("resultScreen");
    const progress = document.getElementById("progress");
    const counter = document.getElementById("counter");
    const questionAxis = document.getElementById("questionAxis");
    const questionTitle = document.getElementById("questionTitle");
    const scale = document.getElementById("scale");
    const miniList = document.getElementById("miniList");
    const backButton = document.getElementById("backButton");
    const nextButton = document.getElementById("nextButton");
    const heroKicker = document.getElementById("heroKicker");
    const heroCopy = document.getElementById("heroCopy");
    const sigilType = document.getElementById("sigilType");
    const sigilLabel = document.getElementById("sigilLabel");
    const diffHeading = document.getElementById("diffHeading");
    const typePicker = document.getElementById("typePicker");
    const resultCardFrame = document.getElementById("resultCardFrame");
    const resultCardImage = document.getElementById("resultCardImage");
    const showCardButton = document.getElementById("showCardButton");
    const shareResultButton = document.getElementById("shareResultButton");

    let latestResultCardUrl = "";
    let latestResultCardBlob = null;
    let latestShareText = "";

    const showScreen = (screen) => {
      [startScreen, quizScreen, resultScreen].forEach((item) => item.classList.remove("active"));
      screen.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const isMobileQuiz = () => window.matchMedia("(max-width: 520px)").matches;

    function getCurrentProfile() {
      return mbtiTypeProfiles[currentMbti];
    }

    function updateTypeDisplay() {
      const profile = getCurrentProfile();
      heroKicker.textContent = `${currentMbti} subtype diagnostic`;
      heroCopy.textContent = `MBTIタイプの中にある、あなただけの傾向を見つけます。\n現在の選択：${currentMbti}（${profile.alias}）`;
      sigilType.textContent = currentMbti;
      sigilLabel.textContent = profile.profileLabel;
      diffHeading.textContent = `${currentMbti}予想値との差分`;
      document.querySelector(".type-mark").textContent = profile.resultHeading;
      document.querySelectorAll(".type-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.mbti === currentMbti);
      });
    }

    function renderTypePicker() {
      typePicker.innerHTML = "";
      mbtiCatalog.forEach((group) => {
        const groupEl = document.createElement("div");
        groupEl.className = "type-group";
        groupEl.innerHTML = `
          <div class="type-group-title">${group.group}</div>
          <div class="type-options"></div>
        `;
        const optionsEl = groupEl.querySelector(".type-options");

        group.types.forEach((type, typeIndex) => {
          const button = document.createElement("button");
          button.className = "type-button";
          button.type = "button";
          button.dataset.mbti = type.code;
          button.style.setProperty("--pos-x", `${typeIndex * 100 / 3}%`);
          button.style.setProperty("--pos-y", `${mbtiCatalog.indexOf(group) * 100 / 3}%`);
          button.setAttribute("aria-label", `${type.code} ${type.alias}`);
          button.innerHTML = `
            <span class="type-code">${type.code}</span>
            <span class="type-name">${type.alias}</span>
          `;
          button.addEventListener("click", () => {
            currentMbti = type.code;
            state.index = 0;
            state.answers = Array(questions.length).fill(null);
            updateTypeDisplay();
            renderMiniScores();
          });
          optionsEl.appendChild(button);
        });

        typePicker.appendChild(groupEl);
      });
    }

    function calculateScores() {
      const base = Object.fromEntries(Object.keys(attributes).map((key) => [key, 50]));
      state.answers.forEach((answer, questionIndex) => {
        if (answer === null) return;
        const normalized = answer - 3;
        Object.entries(questions[questionIndex].weights).forEach(([key, weight]) => {
          base[key] += normalized * weight * 8;
        });
      });
      return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, Math.round(clamp(value, 8, 96))]));
    }

    function getDeviationScores(scores) {
      const expectedScores = getCurrentProfile().expectedScores;
      return Object.fromEntries(
        Object.keys(attributes).map((key) => [key, scores[key] - expectedScores[key]])
      );
    }

    function getRankedAttributes(scores) {
      const deviations = getDeviationScores(scores);
      return Object.keys(attributes).sort((a, b) => deviations[b] - deviations[a]);
    }

    function getLowestDeviationAttribute(deviations) {
      return Object.keys(attributes).sort((a, b) => deviations[a] - deviations[b])[0];
    }

    function getSubtypeName(attributeKey) {
      const profile = getCurrentProfile();
      return `${profile.subtypeLabels[attributeKey]}の${profile.alias}（${currentMbti}）`;
    }

    function getContrastName(attributeKey) {
      return getCurrentProfile().contrastLabels[attributeKey];
    }

    function getSubtypeCategory(attributeKey) {
      return getCurrentProfile().expectedScores[attributeKey] >= 65 ? "強化型" : "変異型";
    }

    function buildGeneratedSubtype(primary, contrast) {
      const profile = getCurrentProfile();
      const primaryLabel = profile.subtypeLabels[primary];
      const contrastLabel = profile.contrastLabels[contrast];
      const { titleBodies, summaryBodies, contrastBodies } = copyTemplates;
      return {
        title: `${titleBodies[primary][contrast]}${profile.alias}（${currentMbti}）`,
        shortLabel: `${primaryLabel} × ${contrastLabel}`,
        summary: `${summaryBodies[primary]}${currentMbti}です。${contrastBodies[contrast]}。`
      };
    }

    function renderQuestion() {
      const question = questions[state.index];
      const answeredCount = state.answers.filter((answer) => answer !== null).length;
      progress.style.width = `${(answeredCount / questions.length) * 100}%`;
      counter.textContent = `${state.index + 1} / ${questions.length}`;
      questionAxis.textContent = question.axis;
      questionTitle.textContent = question.text;
      backButton.disabled = state.index === 0;
      backButton.style.opacity = state.index === 0 ? "0.45" : "1";
      nextButton.textContent = state.index === questions.length - 1 ? "結果を見る" : "次へ";

      scale.innerHTML = "";
      const labels = [
        `とても近い：${question.low}`,
        `やや近い：${question.low}`,
        "どちらとも言えない",
        `やや近い：${question.high}`,
        `とても近い：${question.high}`
      ];

      labels.forEach((label, index) => {
        const value = index + 1;
        const button = document.createElement("button");
        button.className = `scale-option${state.answers[state.index] === value ? " selected" : ""}`;
        button.type = "button";
        button.innerHTML = `<span class="scale-number">${value}</span><span>${label}</span>`;
        button.addEventListener("click", () => {
          state.answers[state.index] = value;
          renderQuestion();
          if (isMobileQuiz()) {
            window.setTimeout(() => {
              if (state.index === questions.length - 1) {
                renderResult();
                return;
              }
              state.index += 1;
              renderQuestion();
            }, 220);
          }
        });
        scale.appendChild(button);
      });

      renderMiniScores();
    }

    function renderMiniScores() {
      const scores = calculateScores();
      miniList.innerHTML = "";
      Object.entries(attributes).forEach(([key, attribute]) => {
        const row = document.createElement("div");
        row.className = "mini-row";
        row.innerHTML = `
          <div class="mini-label"><span>${attribute.label}</span><span>${scores[key]}</span></div>
          <div class="mini-track"><div class="mini-fill" style="width: ${scores[key]}%"></div></div>
        `;
        miniList.appendChild(row);
      });
    }

    let radarAnimationId = null;

    function drawRadar(scores, options = {}) {
      if (radarAnimationId) {
        cancelAnimationFrame(radarAnimationId);
        radarAnimationId = null;
      }
      const canvas = document.getElementById("radarChart");
      const ctx = canvas.getContext("2d");
      const labels = Object.keys(attributes);
      const center = canvas.width / 2;
      const radius = canvas.width * 0.31;
      const outerRadius = canvas.width * 0.42;
      const startTime = performance.now();
      const duration = options.animate === false ? 1 : 2300;
      const pointDelay = 150;
      const pointDuration = 420;

      const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
      const clamp01 = (value) => clamp(value, 0, 1);

      function pointFor(index, value, scale = 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
        const pointRadius = radius * value / 100 * scale;
        return {
          angle,
          x: center + Math.cos(angle) * pointRadius,
          y: center + Math.sin(angle) * pointRadius
        };
      }

      function drawPolygon(points, close = true) {
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        if (close) ctx.closePath();
      }

      function drawMagicCircle(progress, litCount) {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(progress * Math.PI * 0.08);
        ctx.translate(-center, -center);

        [outerRadius, outerRadius * 0.88, radius].forEach((ringRadius, index) => {
          ctx.beginPath();
          ctx.arc(center, center, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = index === 0 ? "rgba(243,216,144,0.58)" : "rgba(126,167,200,0.22)";
          ctx.lineWidth = index === 0 ? 3 : 1.5;
          ctx.stroke();
        });

        for (let i = 0; i < 24; i += 1) {
          const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 24;
          const inner = outerRadius * 0.91;
          const outer = outerRadius * (i % 3 === 0 ? 1.02 : 0.98);
          ctx.beginPath();
          ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
          ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
          ctx.strokeStyle = i < progress * 24 ? "rgba(243,216,144,0.48)" : "rgba(255,255,255,0.08)";
          ctx.lineWidth = i % 3 === 0 ? 2 : 1;
          ctx.stroke();
        }

        labels.forEach((key, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
          const lit = index < litCount;
          const runeRadius = outerRadius * 0.76;
          const x = center + Math.cos(angle + Math.PI / labels.length) * runeRadius;
          const y = center + Math.sin(angle + Math.PI / labels.length) * runeRadius;
          ctx.beginPath();
          ctx.arc(x, y, lit ? 7 : 4, 0, Math.PI * 2);
          ctx.fillStyle = lit ? "rgba(243,216,144,0.9)" : "rgba(255,255,255,0.1)";
          ctx.shadowColor = "rgba(243,216,144,0.6)";
          ctx.shadowBlur = lit ? 18 : 0;
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        ctx.restore();
      }

      function renderFrame(now) {
        const elapsed = now - startTime;
        const progress = easeOutCubic(clamp01(elapsed / duration));
        const litCount = Math.min(labels.length, Math.floor(elapsed / pointDelay));
        const polygonProgress = easeOutCubic(clamp01((elapsed - 720) / 900));
        const fillProgress = easeOutCubic(clamp01((elapsed - 1320) / 640));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.font = "700 26px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

        drawMagicCircle(progress, litCount);

      for (let ring = 1; ring <= 5; ring += 1) {
        ctx.beginPath();
        labels.forEach((key, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
          const pointRadius = radius * ring / 5;
          const x = center + Math.cos(angle) * pointRadius;
          const y = center + Math.sin(angle) * pointRadius;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
          ctx.strokeStyle = ring === 5 ? "rgba(217,181,109,0.38)" : "rgba(255,255,255,0.09)";
          ctx.lineWidth = ring === 5 ? 2 : 1;
        ctx.stroke();
      }

      labels.forEach((key, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(x, y);
          ctx.strokeStyle = index < litCount ? "rgba(243,216,144,0.5)" : "rgba(255,255,255,0.09)";
          ctx.lineWidth = index < litCount ? 2 : 1;
        ctx.stroke();
      });

        const animatedPoints = labels.map((key, index) => {
          const localProgress = easeOutCubic(clamp01((elapsed - index * pointDelay) / pointDuration));
          return pointFor(index, scores[key], localProgress);
        });

        if (polygonProgress > 0) {
          ctx.beginPath();
          drawPolygon(animatedPoints);
          const gradient = ctx.createRadialGradient(center, center, 12, center, center, radius);
          gradient.addColorStop(0, `rgba(243,216,144,${0.18 * fillProgress})`);
          gradient.addColorStop(1, `rgba(126,167,200,${0.28 * fillProgress})`);
          ctx.fillStyle = gradient;
          ctx.strokeStyle = `rgba(243,216,144,${0.3 + 0.7 * polygonProgress})`;
          ctx.lineWidth = 3;
          ctx.shadowColor = "rgba(243,216,144,0.45)";
          ctx.shadowBlur = 18 * polygonProgress;
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        animatedPoints.forEach((point, index) => {
          const localProgress = clamp01((elapsed - index * pointDelay) / pointDuration);
          const isLit = localProgress > 0;
          ctx.beginPath();
          ctx.arc(point.x, point.y, isLit ? 7 + 3 * (1 - Math.min(localProgress, 1)) : 0, 0, Math.PI * 2);
          ctx.fillStyle = isLit ? attributes[labels[index]].color : "transparent";
          ctx.shadowColor = attributes[labels[index]].color;
          ctx.shadowBlur = isLit ? 22 : 0;
          ctx.fill();
          ctx.shadowBlur = 0;
        });

      labels.forEach((key, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
          const labelRadius = outerRadius + 34;
        const x = center + Math.cos(angle) * labelRadius;
        const y = center + Math.sin(angle) * labelRadius;
          ctx.fillStyle = index < litCount ? attributes[key].color : "rgba(184,178,165,0.48)";
        ctx.fillText(attributes[key].label, x, y);
      });

        if (elapsed < duration + labels.length * pointDelay) {
          radarAnimationId = requestAnimationFrame(renderFrame);
        } else {
          radarAnimationId = null;
        }
      }

      radarAnimationId = requestAnimationFrame(renderFrame);
    }

    function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
      const lines = getCanvasTextLines(ctx, text, maxWidth);
      const visibleLines = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].slice(0, -1)}…`;
      }

      visibleLines.forEach((row, index) => {
        ctx.fillText(row, x, y + index * lineHeight);
      });
      return y + visibleLines.length * lineHeight;
    }

    function getCanvasTextLines(ctx, text, maxWidth) {
      const chars = [...text];
      const tokens = [];
      let latin = "";
      chars.forEach((char) => {
        if (/[A-Za-z0-9]/.test(char)) {
          latin += char;
          return;
        }
        if (latin) {
          tokens.push(latin);
          latin = "";
        }
        tokens.push(char);
      });
      if (latin) tokens.push(latin);
      const lines = [];
      let line = "";

      tokens.forEach((token) => {
        const testLine = line + token;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = token;
        } else {
          line = testLine;
        }
      });
      if (line) lines.push(line);
      return lines;
    }

    function drawFittedCanvasLine(ctx, text, x, y, maxWidth, options) {
      const { maxSize, minSize, weight, family } = options;
      let size = maxSize;
      do {
        ctx.font = `${weight} ${size}px ${family}`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
      } while (size >= minSize);
      ctx.fillText(text, x, y);
      return y + size * 1.12;
    }

    function drawFittedCanvasBlock(ctx, text, x, y, maxWidth, maxHeight, options) {
      const { maxSize, minSize, weight, family, lineHeightRatio } = options;
      let size = maxSize;
      let lines = [];
      let lineHeight = size * lineHeightRatio;

      do {
        ctx.font = `${weight} ${size}px ${family}`;
        lineHeight = size * lineHeightRatio;
        lines = getCanvasTextLines(ctx, text, maxWidth);
        if (lines.length * lineHeight <= maxHeight) break;
        size -= 1;
      } while (size >= minSize);

      if (lines.length * lineHeight > maxHeight) {
        lineHeight = maxHeight / Math.max(lines.length, 1);
      }

      lines.forEach((row, index) => {
        ctx.fillText(row, x, y + index * lineHeight);
      });
      return y + lines.length * lineHeight;
    }

    function dataUrlToBlob(dataUrl) {
      const [header, base64] = dataUrl.split(",");
      const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }

    function drawCardRadar(ctx, scores, centerX, centerY, radius) {
      const labels = Object.keys(attributes);
      const points = labels.map((key, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
        const pointRadius = radius * scores[key] / 100;
        return {
          key,
          angle,
          x: centerX + Math.cos(angle) * pointRadius,
          y: centerY + Math.sin(angle) * pointRadius
        };
      });

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.strokeStyle = "rgba(243,216,144,0.28)";
      ctx.lineWidth = 2;
      [1, 0.78, 0.56, 0.34].forEach((scale) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      });

      for (let i = 0; i < 24; i += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 24;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9);
        ctx.lineTo(Math.cos(angle) * radius * 1.05, Math.sin(angle) * radius * 1.05);
        ctx.strokeStyle = i % 3 === 0 ? "rgba(243,216,144,0.34)" : "rgba(255,255,255,0.1)";
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      labels.forEach((key, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      const fill = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
      fill.addColorStop(0, "rgba(243,216,144,0.34)");
      fill.addColorStop(1, "rgba(126,167,200,0.32)");
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(243,216,144,0.92)";
      ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(243,216,144,0.45)";
      ctx.shadowBlur = 28;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = attributes[point.key].color;
        ctx.shadowColor = attributes[point.key].color;
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.font = "700 30px 'Yu Gothic UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      labels.forEach((key, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
        const labelRadius = radius + 56;
        ctx.fillStyle = attributes[key].color;
        ctx.fillText(attributes[key].label, centerX + Math.cos(angle) * labelRadius, centerY + Math.sin(angle) * labelRadius);
      });
    }

    function drawResultCardBadges(ctx, badges, x, y, maxWidth) {
      let cursorX = x;
      let cursorY = y;
      const gap = 10;
      const rowGap = 10;
      const height = 46;

      ctx.textBaseline = "middle";
      ctx.font = "800 24px 'Yu Gothic UI', sans-serif";
      badges.forEach((badge, index) => {
        const textWidth = ctx.measureText(badge).width;
        const width = Math.min(maxWidth, textWidth + 34);
        if (cursorX > x && cursorX + width > x + maxWidth) {
          cursorX = x;
          cursorY += height + rowGap;
        }

        const radius = height / 2;
        ctx.beginPath();
        roundedRectPath(ctx, cursorX, cursorY, width, height, radius);
        ctx.fillStyle = index === 0 ? "rgba(243,216,144,0.92)" : "rgba(8,10,15,0.62)";
        ctx.strokeStyle = index === 0 ? "rgba(255,248,221,0.56)" : "rgba(243,216,144,0.24)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = index === 0 ? "#111216" : "rgba(244,239,227,0.9)";
        ctx.fillText(badge, cursorX + 17, cursorY + height / 2);
        cursorX += width + gap;
      });

      return cursorY + height;
    }

    function roundedRectPath(ctx, x, y, width, height, radius) {
      if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, radius);
        return;
      }
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    function createResultCard({ scores, title, subtitle, description, typeHeading, badges }) {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1440;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#090b10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createRadialGradient(820, 180, 40, 520, 520, 900);
      bg.addColorStop(0, "rgba(217,181,109,0.34)");
      bg.addColorStop(0.46, "rgba(22,32,48,0.84)");
      bg.addColorStop(1, "rgba(8,10,15,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(243,216,144,0.28)";
      ctx.lineWidth = 2;
      ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);
      ctx.strokeStyle = "rgba(126,167,200,0.16)";
      ctx.strokeRect(72, 72, canvas.width - 144, canvas.height - 144);

      ctx.save();
      ctx.translate(540, 488);
      ctx.rotate(-0.12);
      ctx.strokeStyle = "rgba(243,216,144,0.08)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, 250 + i * 54, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(243,216,144,0.92)";
      ctx.font = "800 30px 'Segoe UI', sans-serif";
      ctx.letterSpacing = "0px";
      ctx.fillText(typeHeading, 92, 92);

      ctx.fillStyle = "#fff4d2";
      let y = drawFittedCanvasLine(ctx, title, 92, 150, 896, {
        maxSize: 70,
        minSize: 42,
        weight: 800,
        family: "'Yu Mincho', 'Hiragino Mincho ProN', serif"
      });

      y = drawResultCardBadges(ctx, badges, 92, y + 22, 896);

      ctx.fillStyle = "rgba(244,239,227,0.78)";
      y = drawFittedCanvasBlock(ctx, subtitle, 92, y + 26, 896, 112, {
        maxSize: 31,
        minSize: 22,
        weight: 700,
        family: "'Yu Gothic UI', sans-serif",
        lineHeightRatio: 1.48
      });

      ctx.fillStyle = "rgba(244,239,227,0.9)";
      drawFittedCanvasBlock(ctx, description, 92, y + 34, 896, 360, {
        maxSize: 31,
        minSize: 20,
        weight: 500,
        family: "'Yu Gothic UI', sans-serif",
        lineHeightRatio: 1.58
      });

      drawCardRadar(ctx, scores, 540, 1014, 260);

      const dataUrl = canvas.toDataURL("image/png");
      latestResultCardBlob = dataUrlToBlob(dataUrl);
      return dataUrl;
    }

    function renderResult() {
      const scores = calculateScores();
      const deviations = getDeviationScores(scores);
      const ranked = getRankedAttributes(scores);
      const primary = ranked[0];
      const secondary = ranked[1];
      const contrast = getLowestDeviationAttribute(deviations);
      const typeProfile = getCurrentProfile();
      const generatedSet = generatedSubtypeMap[currentMbti];
      const generated = generatedSet?.[primary]?.[contrast] ?? buildGeneratedSubtype(primary, contrast);
      const copy = subtypeCopy[primary];
      const description = `${copy.body}${contrastCopy[contrast]}`.replaceAll("INFP", currentMbti);
      const categoryLabel = getSubtypeCategory(primary);
      const primaryLabel = `主属性：${attributes[primary].label}`;
      const secondaryLabel = `副属性：${attributes[secondary].label}`;
      const contrastLabel = generated?.shortLabel ?? `コントラスト：${getContrastName(contrast)}`;

      document.querySelector(".type-mark").textContent = typeProfile.resultHeading;
      document.getElementById("resultTitle").textContent = generated?.title ?? getSubtypeName(primary);
      document.getElementById("resultSubtitle").textContent = generated?.summary ?? copy.lead;
      document.getElementById("categoryBadge").textContent = categoryLabel;
      document.getElementById("primaryBadge").textContent = primaryLabel;
      document.getElementById("secondaryBadge").textContent = secondaryLabel;
      document.getElementById("contrastBadge").textContent = contrastLabel;
      document.getElementById("description").textContent = description;

      const resultTitle = generated?.title ?? getSubtypeName(primary);
      const resultSubtitle = generated?.summary ?? copy.lead;
      latestShareText = `${resultTitle}\n${resultSubtitle}\n${publicSiteUrl}`;
      latestResultCardUrl = createResultCard({
        scores,
        title: resultTitle.replace(`（${currentMbti}）`, ""),
        subtitle: resultSubtitle,
        description,
        typeHeading: typeProfile.resultHeading,
        badges: [categoryLabel, primaryLabel, secondaryLabel, contrastLabel]
      });
      resultCardImage.src = latestResultCardUrl;
      resultCardImage.alt = `${resultTitle}の診断結果カード`;
      resultCardFrame.hidden = true;
      showCardButton.textContent = "診断結果カードを表示";

      const diffList = document.getElementById("diffList");
      diffList.innerHTML = "";
      Object.entries(attributes).forEach(([key, attribute]) => {
        const diff = deviations[key];
        const width = Math.min(Math.abs(diff), 50);
        const row = document.createElement("div");
        row.className = "diff-item";
        row.innerHTML = `
          <span>${attribute.label}</span>
          <span class="diff-track">
            <span class="diff-fill" style="${diff >= 0 ? "left: 50%;" : `right: 50%;`} width: ${width}%;"></span>
          </span>
          <span>${diff >= 0 ? "+" : ""}${diff}</span>
        `;
        diffList.appendChild(row);
      });

      drawRadar(scores);
      showScreen(resultScreen);
    }

    document.getElementById("startButton").addEventListener("click", () => {
      state.index = 0;
      renderQuestion();
      showScreen(quizScreen);
    });

    document.getElementById("sampleButton").addEventListener("click", () => {
      state.answers = [4, 2, 5, 3, 4, 5, 2, 4, 2, 1];
      renderResult();
    });

    backButton.addEventListener("click", () => {
      if (state.index === 0) return;
      state.index -= 1;
      renderQuestion();
    });

    nextButton.addEventListener("click", () => {
      if (state.answers[state.index] === null) {
        scale.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }],
          { duration: 180 }
        );
        return;
      }
      if (state.index === questions.length - 1) {
        renderResult();
        return;
      }
      state.index += 1;
      renderQuestion();
    });

    document.getElementById("restartButton").addEventListener("click", () => {
      state.index = 0;
      state.answers = Array(questions.length).fill(null);
      renderQuestion();
      showScreen(quizScreen);
    });

    document.getElementById("editButton").addEventListener("click", () => {
      state.index = 0;
      renderQuestion();
      showScreen(quizScreen);
    });

    showCardButton.addEventListener("click", () => {
      const willShow = resultCardFrame.hidden;
      resultCardFrame.hidden = !willShow;
      showCardButton.textContent = willShow ? "診断結果カードを閉じる" : "診断結果カードを表示";
    });

    shareResultButton.addEventListener("click", async () => {
      if (!latestResultCardUrl) return;
      const file = latestResultCardBlob ? new File([latestResultCardBlob], "mbti-result-card.png", { type: "image/png" }) : null;

      try {
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "MBTIタイプ拡張診断",
            text: latestShareText,
            url: publicSiteUrl,
            files: [file]
          });
          return;
        }
        if (navigator.share) {
          await navigator.share({
            title: "MBTIタイプ拡張診断",
            text: latestShareText,
            url: publicSiteUrl
          });
          return;
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
      }

      resultCardFrame.hidden = false;
      showCardButton.textContent = "診断結果カードを閉じる";
      navigator.clipboard?.writeText(latestShareText).catch(() => {});
      window.open(latestResultCardUrl, "_blank", "noopener");
    });

    loadAppData()
      .then(() => {
        state.answers = Array(questions.length).fill(null);
        renderTypePicker();
        updateTypeDisplay();
        renderMiniScores();
      })
      .catch((error) => {
        console.error(error);
        document.body.insertAdjacentHTML(
          "afterbegin",
          '<div class="data-error">診断データの読み込みに失敗しました。ローカルサーバー経由で開き直してください。</div>'
        );
      });
