---
name: invisible
description: Research NEAR projects using measured signer activity, contract evidence, and published tokenomics from Invisible. Use for project discovery, returning-signer comparisons, and source-backed ranking explanations.
---

# Invisible NEAR Research

Use the Invisible MCP server at https://invisible-gray.vercel.app/api/mcp when available. Its tools are search_projects, get_project_evidence, and get_rankings. The same data is available through the public REST API.

## Workflow

1. Search with GET https://invisible-gray.vercel.app/api/v1/projects?q=rhea or the search_projects tool. Use the verified registry ID returned for the project.
2. Read GET https://invisible-gray.vercel.app/api/v1/projects/rhea or get_project_evidence. Cite the contract attribution URLs and example transactions that support the answer.
3. Compare GET https://invisible-gray.vercel.app/api/v1/returning-signers?limit=10 or get_rankings with metric returning. For investment comparisons, use /api/v1/investment and explain the market inputs separately.
4. Include the snapshot cutoff, the contracts covered, and any eligibility or evidence gaps. A signer is a NEAR account. The latest 28-day window ends immediately before the cutoff in UTC.

A forecast from /api/v1/forecast is a scenario based on observed cohorts. Report its historical error when available and keep it separate from measured activity. Treat missing evidence as unavailable. Never infer social engagement, users, or a token launch from signer activity.
