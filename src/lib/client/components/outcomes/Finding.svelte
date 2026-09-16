<script lang="ts">
  import { formatCopy } from "$lib/shared/domain/guide-view";
  import type { SpecFinding, StandardsFinding } from "$lib/shared/contracts/outcomes";

  let { finding }: { finding: StandardsFinding | SpecFinding } = $props();

  const classification = $derived("classification" in finding ? finding.classification : "");
  const location = $derived.by(() => {
    if (!finding.location) return "";
    const end =
      finding.location.endLine != null && finding.location.endLine !== finding.location.startLine
        ? `–${finding.location.endLine}`
        : "";
    return `${finding.location.path}:${finding.location.startLine}${end}`;
  });
</script>

<article class="finding">
  <div class="finding-meta">
    <span class="severity severity-{finding.severity}">{finding.severity}</span>
    {#if classification}
      <span class="classification">{classification}</span>
    {/if}
  </div>
  <h3>{finding.title}</h3>
  <div class="explanation">{@html formatCopy(finding.explanation)}</div>
  {#if finding.recommendation}
    <div class="recommendation">
      <span class="finding-label">Recommendation</span>
      {@html formatCopy(finding.recommendation)}
    </div>
  {/if}
  {#if location}
    <p class="location">{location}</p>
  {/if}
  {#if finding.reference}
    <p class="reference">
      <span class="finding-label">{finding.reference.source}</span>
      {#if finding.reference.quote}
        — {finding.reference.quote}
      {/if}
    </p>
  {/if}
</article>
