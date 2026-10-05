/**
 * Makes `ctx.fillText` shrink the font of any line that would run past the canvas edge (taking the text alignment into
 * account), so printed signs and labels are never cut off. Fonts must be given in px.
 */
export function autoFitText(ctx: CanvasRenderingContext2D, w: number, margin = 0.05): void {
  const plain = ctx.fillText.bind(ctx);
  ctx.fillText = (text: string, x: number, y: number) => {
    const m = ctx.measureText(text).width;
    const edge = w * margin;
    const room = ctx.textAlign === 'left' || ctx.textAlign === 'start' ? w - edge - x : ctx.textAlign === 'right' || ctx.textAlign === 'end' ? x - edge : 2 * Math.min(x - edge, w - edge - x);
    if (m <= room || room <= 4) return plain(text, x, y);
    const f = ctx.font;
    ctx.font = f.replace(/(\d+(?:\.\d+)?)px/, (_, n: string) => `${((+n * room) / m).toFixed(1)}px`);
    plain(text, x, y);
    ctx.font = f;
  };
}
