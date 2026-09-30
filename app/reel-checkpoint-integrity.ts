function text(value: unknown) {
  return String(value || "").trim();
}
function batchId(value: any) {
  return (
    Number(
      value?._productionBatchId || value?.productionBatchId || value?.batchId,
    ) || 0
  );
}
function items(value: any) {
  return Array.isArray(value?.reel_video_items) ? value.reel_video_items : [];
}
function contentId(value: any, index: number) {
  return text(value?.contentId || value?.content_id || `content_${index + 1}`);
}
function title(value: any) {
  return text(value?.title).toLowerCase().replace(/\s+/g, " ");
}
function anchorKey(value: any) {
  return text(
    value?.firstFrame?.itemKey ||
      value?.first_frame?.item_key ||
      value?.approvedAnchorImage?.itemKey ||
      value?.approved_anchor_image?.item_key,
  );
}
function approvedReels(production: any) {
  return (
    Array.isArray(production?.production_items)
      ? production.production_items
      : []
  ).filter(
    (item: any) =>
      text(item?.contentType || item?.content_type).toLowerCase() === "reel",
  );
}

export function reelCheckpointMatchesApproved(
  candidate: any,
  approvedProduction: any,
) {
  const content =
      candidate?.content && typeof candidate.content === "object"
        ? candidate.content
        : candidate || {},
    expected = approvedReels(approvedProduction),
    actual = items(content),
    expectedBatch = batchId(approvedProduction),
    candidateBatch = batchId(candidate) || batchId(content);
  if (
    !expectedBatch ||
    candidateBatch !== expectedBatch ||
    !expected.length ||
    actual.length !== expected.length
  )
    return false;
  const byId = new Map(
    actual.map((item: any, index: number) => [contentId(item, index), item]),
  );
  if (byId.size !== expected.length) return false;
  return expected.every((source: any, index: number) => {
    const id = contentId(source, index),
      found = byId.get(id);
    if (!found || title(found) !== title(source)) return false;
    const approvedAnchor = (
        Array.isArray(source?.assets) ? source.assets : []
      ).find(
        (asset: any, assetIndex: number) =>
          Number(
            asset?.assetNumber || asset?.asset_number || assetIndex + 1,
          ) === 1,
      )?.visualPrompt?.approvedAnchorImage,
      expectedKey = anchorKey({ approvedAnchorImage: approvedAnchor }),
      actualKey = anchorKey(found);
    return !expectedKey || actualKey === expectedKey;
  });
}

export function reelCheckpointEnvelope(content: any, approvedProduction: any) {
  const productionBatchId = batchId(content) || batchId(approvedProduction);
  return {
    phaseKey: "reel-video-production",
    reelStage: content?._reelStage || null,
    productionBatchId,
    content: { ...(content || {}), _productionBatchId: productionBatchId },
  };
}

export function reelRetakeMatchesApproved(event: any, approvedProduction: any) {
  return (
    batchId(event) === batchId(approvedProduction) &&
    batchId(approvedProduction) > 0
  );
}
export function freshReelSetup(approvedProduction: any) {
  return {
    _productionBatchId: batchId(approvedProduction),
    _reelStage: "style_configured",
    reel_video_items: [],
  };
}
