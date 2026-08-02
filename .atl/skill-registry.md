# Skill Registry — finanzas-web-app

Last updated: 2026-07-16

## Sources scanned

- `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills` (project)
- `C:\Users\AlanPolanco\Documents\finanzas-web-app\.claude\skills` (project — none found)
- `C:\Users\AlanPolanco\.claude\skills` (user)
- Other user skill roots checked with no matches: `~/.pi/agent/skills`, `~/.config/agents/skills`, `~/.agents/skills`, `~/.kimi/skills`, `~/.config/opencode/skills`, `~/.config/kilo/skills`, `~/.gemini/skills`, `~/.gemini/antigravity/skills`, `~/.cursor/skills`, `~/.copilot/skills`, `~/.codex/skills`, `~/.codeium/windsurf/skills`, `~/.qwen/skills`, `~/.kiro/skills`, `~/.openclaw/skills`
- Convention files scanned: `AGENTS.md` (index, referenced files inlined below), `docs/PROJECT_DOCUMENTATION.md`, `docs/DOCUMENTACION_version_pasada.md`

Skipped per scan rules: `sdd-*`, `_shared`, `skill-registry` (internal SDD/meta skills, not project-task skills).

## Contract

**Delegator use only.** This registry is an index, not a summary. Any agent that launches subagents reads it to select relevant skills, then passes exact `SKILL.md` paths for the subagent to read before work.

`SKILL.md` remains the source of truth. Do not inject generated summaries or compact rules by default; pass paths so subagents load the full runtime contract and preserve author intent.

## Skills

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `openspec-explore` | Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\openspec-explore\SKILL.md` |
| `openspec-propose` | Propose a new change with all artifacts generated in one step (proposal, design, specs, tasks). | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\openspec-propose\SKILL.md` |
| `openspec-apply-change` | Implement tasks from an OpenSpec change. Use when starting, continuing, or working through implementation tasks. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\openspec-apply-change\SKILL.md` |
| `openspec-sync-specs` | Sync delta specs from a change to main specs without archiving. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\openspec-sync-specs\SKILL.md` |
| `openspec-archive-change` | Archive a completed change in the experimental (non-SDD) openspec workflow. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\openspec-archive-change\SKILL.md` |
| `ui-styling` | Build UIs with shadcn/ui (Radix + Tailwind), Tailwind CSS utility styling, dark mode, canvas-based designs, accessible components. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\ui-styling\SKILL.md` |
| `design-system` | Token architecture (primitive→semantic→component), CSS variables, spacing/typography scales, component specs. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\design-system\SKILL.md` |
| `design` | Comprehensive design skill: brand identity, design tokens, UI styling, logo/CIP/banner/icon generation, HTML presentations. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\design\SKILL.md` |
| `brand` | Brand voice, visual identity, messaging frameworks, brand consistency. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\brand\SKILL.md` |
| `banner-design` | Design banners for social media, ads, website heroes, creative/print assets. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\banner-design\SKILL.md` |
| `slides` | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\slides\SKILL.md` |
| `ui-ux-pro-max` | UI/UX design intelligence with searchable pattern database. | project | `C:\Users\AlanPolanco\Documents\finanzas-web-app\.opencode\skills\ui-ux-pro-max\SKILL.md` |
| `branch-pr` | Create pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | user | `C:\Users\AlanPolanco\.claude\skills\branch-pr\SKILL.md` |
| `chained-pr` | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs. | user | `C:\Users\AlanPolanco\.claude\skills\chained-pr\SKILL.md` |
| `cognitive-doc-design` | Design docs that reduce cognitive load. Trigger: guides, READMEs, RFCs, onboarding, architecture docs. | user | `C:\Users\AlanPolanco\.claude\skills\cognitive-doc-design\SKILL.md` |
| `comment-writer` | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, GitHub comments. | user | `C:\Users\AlanPolanco\.claude\skills\comment-writer\SKILL.md` |
| `go-testing` | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. Not applicable to this TS/Next.js stack. | user | `C:\Users\AlanPolanco\.claude\skills\go-testing\SKILL.md` |
| `issue-creation` | Create GitHub issues with issue-first checks. Trigger: bug reports, feature requests. | user | `C:\Users\AlanPolanco\.claude\skills\issue-creation\SKILL.md` |
| `judgment-day` | Trigger: judgment day, dual review, adversarial review. Blind dual review, fix confirmed issues, re-judge. | user | `C:\Users\AlanPolanco\.claude\skills\judgment-day\SKILL.md` |
| `skill-creator` | Trigger: new skills, agent instructions. Create LLM-first skills with valid frontmatter. | user | `C:\Users\AlanPolanco\.claude\skills\skill-creator\SKILL.md` |
| `skill-improver` | Trigger: improve/audit/refactor skills, skill quality. | user | `C:\Users\AlanPolanco\.claude\skills\skill-improver\SKILL.md` |
| `work-unit-commits` | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs. | user | `C:\Users\AlanPolanco\.claude\skills\work-unit-commits\SKILL.md` |

## Notes

- A prior registry version pointed user-level skills at `~/.config/opencode/skills`. That path does not resolve on this machine; the actual user-level skills live at `~/.claude/skills`. This revision corrects those paths.
- Project already contains a separate, non-SDD `openspec/` directory (`openspec/specs/`, `openspec/changes/archive/...`) created by the `.opencode` skills (`openspec-propose`, `openspec-apply-change`, etc.) from an earlier workflow. It has no `openspec/config.yaml`. This SDD system runs in `engram` mode and does not manage or write to that directory — it is left untouched. See risks in `sdd-init/finanzas-web-app` for detail.

## Loading protocol

1. Match task context and target files against the `Trigger / description` column.
2. Pass only the matching `Path` values to the subagent under `## Skills to load before work`.
3. Instruct the subagent to read those exact `SKILL.md` files before reading, writing, reviewing, testing, or creating artifacts.
4. If no matching skill exists, proceed without project skill injection and report `skill_resolution: none`.
