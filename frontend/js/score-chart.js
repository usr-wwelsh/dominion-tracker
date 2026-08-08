function escapeChartHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseChartDate(ts) {
  return parseServerTime(ts)?.getTime() ?? NaN;
}

// Shared animated score-progression chart (canvas, no library).
// Used by the Recent Games page and Big Picture Mode's end-of-game screen.
// drawScoreChart(canvas, scoreHistory, comments, gameStart, gameEnd) where
// scoreHistory = score_snapshots rows, comments = build_comments rows (only
// those made during play are plotted), gameStart/gameEnd = the game's actual
// started_at/ended_at. The time axis spans gameStart..gameEnd (falling back to
// the snapshot range if not given) rather than just the snapshot min/max —
// a game can go a long stretch with no score change but still get comments,
// and those need a valid position on the axis too.
function drawScoreChart(canvas, scoreHistory, comments = [], gameStart = null, gameEnd = null) {
  if (!scoreHistory || scoreHistory.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b8a884';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No score history available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight || 300;

  ctx.clearRect(0, 0, width, height);

  // Group scores by player
  const playerScores = {};
  scoreHistory.forEach(snapshot => {
    if (!playerScores[snapshot.player_id]) {
      playerScores[snapshot.player_id] = {
        name: snapshot.player_name,
        color: snapshot.player_color,
        scores: []
      };
    }
    playerScores[snapshot.player_id].scores.push({
      timestamp: parseChartDate(snapshot.timestamp),
      score: snapshot.score
    });
  });

  // Score range
  const allScores = scoreHistory.map(s => s.score);
  const minScore = Math.min(0, ...allScores);
  const maxScore = Math.max(...allScores);
  const scoreRange = maxScore - minScore || 1;

  // Shared time axis across all players — widened to the game's actual
  // started_at/ended_at (when known) so it always covers the full session,
  // not just whenever scores happened to change.
  const allTimestamps = scoreHistory.map(s => parseChartDate(s.timestamp));
  let globalFirstTime = Math.min(...allTimestamps);
  let globalLastTime = Math.max(...allTimestamps);
  if (gameStart) globalFirstTime = Math.min(globalFirstTime, parseChartDate(gameStart));
  if (gameEnd) globalLastTime = Math.max(globalLastTime, parseChartDate(gameEnd));
  const globalTimeRange = globalLastTime - globalFirstTime || 1;

  // Timed comment markers ("pop out" as the reveal animation sweeps past them).
  // Only comments made during play (within [globalFirstTime, globalLastTime],
  // i.e. the game's session) are plotted — post-game comments fall outside it.
  const commentsInRange = comments.filter(c => {
    const t = parseChartDate(c.created_at);
    return t >= globalFirstTime && t <= globalLastTime;
  });

  // Reserve extra headroom above the plot for readable comment bubbles (up to
  // two stacked rows) when there are any to show — otherwise keep the usual
  // tight top padding.
  const padding = { top: commentsInRange.length ? 62 : 30, right: 10, bottom: 45, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const commentMarkers = commentsInRange.map(c => ({
    x: padding.left + ((parseChartDate(c.created_at) - globalFirstTime) / globalTimeRange * chartWidth),
    color: c.player_color || '#e8dcc8',
    player_name: c.player_name,
    comment_text: c.comment_text,
  }));

  // Stagger markers that land close together in time into a second row so
  // their bubbles don't overlap (comments are already chronological/x-ascending).
  const ROW_GAP_PX = 110;
  const lastXByRow = [];
  commentMarkers.forEach(m => {
    let row = 0;
    while (lastXByRow[row] !== undefined && (m.x - lastXByRow[row]) < ROW_GAP_PX && row < 1) row++;
    m.row = row;
    lastXByRow[row] = m.x;
  });

  const fallbackColors = ['#e05c5c', '#4db8ff', '#6ddb6d', '#f5a623', '#c47eff', '#00e0c0'];

  const playerData = Object.values(playerScores).map((player, index) => {
    const color = player.color || fallbackColors[index % fallbackColors.length];
    const scores = player.scores.sort((a, b) => a.timestamp - b.timestamp);
    if (scores.length === 0) return null;

    // Map to canvas coords using the shared time axis
    const rawPoints = scores.map(point => ({
      x: padding.left + ((point.timestamp - globalFirstTime) / globalTimeRange * chartWidth),
      y: height - padding.bottom - ((point.score - minScore) / scoreRange * chartHeight),
      isData: true,
    }));

    // Build step points: hold value flat until next update, then jump vertically
    const stepPoints = [];
    for (let i = 0; i < rawPoints.length; i++) {
      stepPoints.push(rawPoints[i]);
      if (i < rawPoints.length - 1) {
        // Horizontal segment to next x at current y (no dot here)
        stepPoints.push({ x: rawPoints[i + 1].x, y: rawPoints[i].y, isData: false });
      }
    }

    // Extend the last value horizontally to the right edge
    const lastStep = stepPoints[stepPoints.length - 1];
    const endX = padding.left + chartWidth;
    if (lastStep.x < endX - 1) {
      stepPoints.push({ x: endX, y: lastStep.y, isData: false });
    }

    const finalScore = scores[scores.length - 1].score;
    return { name: player.name, color, points: stepPoints, finalScore };
  }).filter(Boolean);

  drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange);

  // Comment bubbles — canvas can't render selectable/wrapping text well, so
  // overlay small readable HTML chips positioned over the canvas. The full
  // text is also in `title` for a native tooltip on hover (desktop bonus).
  // Bubbles are appended to the canvas's parent, which may have other
  // siblings above the canvas (e.g. .chart-title), so positions must account
  // for the canvas's own offset within it, not assume top-left is (0,0).
  const parent = canvas.parentElement;
  if (parent) {
    parent.querySelectorAll(':scope > .chart-comment-bubble').forEach(el => el.remove());
  }
  const canvasOffsetLeft = canvas.offsetLeft;
  const canvasOffsetTop = canvas.offsetTop;
  const commentBubbleEls = parent ? commentMarkers.map(marker => {
    const el = document.createElement('div');
    el.className = 'chart-comment-bubble';
    el.title = `${marker.player_name}: ${marker.comment_text}`;
    el.style.cssText = `position:absolute;left:${canvasOffsetLeft + marker.x}px;top:${canvasOffsetTop + 4 + marker.row * 26}px;border-left-color:${marker.color};opacity:0;`;
    el.innerHTML = `<strong>${escapeChartHtml(marker.player_name)}:</strong> ${escapeChartHtml(marker.comment_text)}`;
    parent.appendChild(el);
    return { el, x: marker.x };
  }) : [];

  const totalDuration = 3500;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);

    // Animate by time position: all players draw up to the same x coordinate each frame
    const animX = padding.left + (progress * chartWidth);

    ctx.clearRect(0, 0, width, height);
    drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange);

    playerData.forEach((player, playerIndex) => {
      // Find how many full points fall at or before animX
      let pointsToDraw = 0;
      for (let i = 0; i < player.points.length; i++) {
        if (player.points[i].x <= animX) pointsToDraw = i + 1;
        else break;
      }
      if (pointsToDraw < 1) return;

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';
      ctx.beginPath();

      for (let i = 0; i < pointsToDraw; i++) {
        const point = player.points[i];
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }

      // Interpolate partial segment to animX if there's a next point
      if (progress < 1 && pointsToDraw < player.points.length) {
        const lastPoint = player.points[pointsToDraw - 1];
        const nextPoint = player.points[pointsToDraw];
        const segProgress = (animX - lastPoint.x) / (nextPoint.x - lastPoint.x);
        if (segProgress > 0) {
          const interpX = animX;
          const interpY = lastPoint.y + (nextPoint.y - lastPoint.y) * segProgress;
          ctx.lineTo(interpX, interpY);
        }
      }

      ctx.stroke();

      // Dots only at real data points (isData === true)
      for (let i = 0; i < pointsToDraw; i++) {
        const point = player.points[i];
        if (!point.isData) continue;
        // Fade in dot as animX passes through it
        const dotProgress = Math.min(1, Math.max(0, (animX - point.x) / (chartWidth * 0.02 + 1)) * 2);
        const pointScale = dotProgress;
        const pointAlpha = dotProgress;

        ctx.fillStyle = player.color;
        ctx.globalAlpha = pointAlpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 * pointScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Legend top-left
      if (playerIndex === 0 || progress >= 0.5) {
        const legendProgress = Math.min(1, (progress - 0.3) / 0.4);
        const legendAlpha = Math.max(0, legendProgress);
        const legendX = padding.left + 8;
        const legendY = padding.top + (playerIndex * 20);

        ctx.globalAlpha = legendAlpha;
        ctx.fillStyle = player.color;
        ctx.fillRect(legendX, legendY - 6, 10 * legendProgress, 10 * legendProgress);
        ctx.fillStyle = '#e8dcc8';
        ctx.textAlign = 'left';
        ctx.font = '11px Georgia, serif';
        ctx.fillText(player.name, legendX + 14, legendY + 4);
        ctx.globalAlpha = 1;
      }

      // Final score label at right edge of line
      if (progress >= 0.85) {
        const labelAlpha = Math.min(1, (progress - 0.85) / 0.15);
        const lastPoint = player.points[player.points.length - 1];
        ctx.globalAlpha = labelAlpha;
        ctx.fillStyle = player.color;
        ctx.font = 'bold 11px Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(player.finalScore, lastPoint.x - 3, lastPoint.y - 5);
        ctx.globalAlpha = 1;
      }
    });

    // Timed comment markers — reuse the same fade-in-on-sweep math as the
    // score dots above, so they "pop out" as the reveal animation passes them.
    commentMarkers.forEach((marker, i) => {
      const markProgress = Math.min(1, Math.max(0, (animX - marker.x) / (chartWidth * 0.02 + 1)) * 2);
      const bubble = commentBubbleEls[i];
      if (bubble) {
        bubble.el.style.opacity = String(markProgress);
        bubble.el.style.pointerEvents = markProgress > 0.5 ? 'auto' : 'none';
      }
      if (markProgress <= 0) return;

      ctx.globalAlpha = markProgress;
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(marker.x, padding.top);
      ctx.lineTo(marker.x, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(marker.x, padding.top, 5 * markProgress, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange) {
  // Dark background matching site theme
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0,   '#18222e');
  bg.addColorStop(0.5, '#1b2636');
  bg.addColorStop(1,   '#18222e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle inset vignette
  const inset = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, Math.max(width, height) * 0.8);
  inset.addColorStop(0, 'rgba(0,0,0,0)');
  inset.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = inset;
  ctx.fillRect(0, 0, width, height);

  // Axes
  ctx.strokeStyle = '#4a6080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Y-axis labels and horizontal gridlines
  ctx.fillStyle = '#b8a884';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const score = minScore + (scoreRange * i / ySteps);
    const y = height - padding.bottom - (chartHeight * i / ySteps);
    ctx.fillText(Math.round(score), padding.left - 6, y + 4);

    ctx.strokeStyle = 'rgba(74, 96, 128, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Emphasized zero baseline when any score went negative
  if (minScore < 0) {
    const zeroY = height - padding.bottom - ((0 - minScore) / scoreRange) * chartHeight;
    ctx.strokeStyle = 'rgba(184, 168, 132, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
  }

  // X-axis time labels and vertical gridlines
  const totalMinutes = globalTimeRange / 60000;
  const intervalMinutes = totalMinutes <= 20 ? 5 : totalMinutes <= 60 ? 10 : totalMinutes <= 120 ? 20 : 30;
  const intervalMs = intervalMinutes * 60000;

  ctx.fillStyle = '#b8a884';
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  for (let t = intervalMs; t < globalTimeRange; t += intervalMs) {
    const x = padding.left + (t / globalTimeRange * chartWidth);
    ctx.fillText(`${Math.round(t / 60000)}m`, x, height - padding.bottom + 14);

    ctx.strokeStyle = 'rgba(74, 96, 128, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Score axis label
  ctx.fillStyle = '#b8a884';
  ctx.textAlign = 'left';
  ctx.font = '13px Georgia, serif';
  ctx.fillText('Score', 4, padding.top - 14);
}
