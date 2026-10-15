# Opportunity rubric — venture-screen-v2

Find opportunities worth investigating within the investment thesis. A project is a technical clue, not the boundary of the opportunity. Keep investigation priority separate from evidence confidence and investment readiness.

## Cheap discovery: saved evidence first

For each group, including earlier exclusions:

1. **Capability:** what does the technology let someone do? Separate demonstrated capability, team claims, and proposed capability.
2. **Problem and customer:** identify the original use and up to two credible adjacent uses. Explain the causal link from capability to benefit, and any extra technical, safety, regulatory or buying requirements. Do not assume transfer works.
3. **Potential scale:** explain a plausible path through customer numbers, spending, frequency or growth. Name missing inputs. A large population or adjacent industry alone is not a market estimate.
4. **Current options:** include products, internal tools, manual work and doing nothing.
5. **Relationship:** compare each important option as an alternative, supplement, different use case, substantially overlapping, or unresolved. Relationships can differ by customer and workflow.
6. **Decision:** give the strongest plausible case, strongest objection, and decisive test. Preserve source links and separate evidence from interpretation and hypotheses.

Revisit exclusions based only on recreation, student origin, narrow original use, missing market evidence or incumbent presence. None is an automatic pass or rejection. Check the broader opportunity against the thesis; do not invent an industrial or medical application just to fit it.

Group by shared customer/problem and practical capability. Different applications with different buyers or safety requirements may be separate hypotheses. Multiple independent projects can strengthen a signal; duplicate records cannot. One credible project can justify investigation.

## Dimensions

Keep the existing seven dimensions. Each receives `supported`, `plausible`, `missing` or `contradicted`, a reason, and supporting claim IDs. Missing evidence is not evidence against the opportunity.

| Dimension       | Evaluate                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| problem         | Importance, consequence and frequency for a specific user, including credible adjacent uses.                                                                              |
| customerPayment | User versus payer, purchasing trigger, budgets and willingness to pay. Proposed buyers remain hypotheses.                                                                 |
| productValue    | A credible mechanism linking the capability to benefit; transfer requirements and tradeoffs. Novelty is not required.                                                     |
| commercialGap   | Additional value through replacement, complementarity or underserved use cases. Existing competitors alone neither validate nor disprove a gap.                           |
| ventureScale    | A plausible path to a large business, then evidence of reachable customers, spending and growth. Demographics and sector totals are context until connected to purchases. |
| businessCapital | Delivery cost, margins, repeatability, distribution, defensibility, capital and regulatory burden.                                                                        |
| timing          | What could make adoption practical now, and what could delay it. Dates and growth claims need evidence.                                                                   |

## Priority, confidence and readiness

- **High investigation priority:** consequential problem, credible capability-to-benefit connection, plausible route to substantial scale, and a specific advantage or complementary role worth testing. Important assumptions may remain unproven; identify them.
- **Medium:** coherent opportunity with a weaker benefit, unclear additional value, or a less convincing scale path. A focused test could materially change the assessment.
- **Low:** weak consequence, implausible transfer, negligible additional value, or strong counterevidence after considering credible adjacent and complementary uses.
- **Insufficient information:** too little to formulate a specific opportunity. Name the missing information; do not call it a bad business.

Give confidence separately as low/moderate/high with a reason. Do not multiply priority by confidence or mechanically average dimensions. Explain the ranking. High priority is not investment endorsement.

**Exploring remains an evidence gate:** inspected support for the problem/customer, practical product value, commercial role and credible venture-scale case under the existing qualification rules. Completing research or receiving positive user feedback does not qualify it. A promising but unproven opportunity remains a Lead.

## Deep research after explicit authorization

The worker instructions in `scripts/research-instructions.ts` implement this rubric across three bounded phases:

- **Problem and customer:** establish the underlying need; test original and credible adjacent applications; distinguish user, payer and beneficiary. Investigate transfer constraints rather than silently assuming them.
- **Market and alternatives:** compare mechanisms, target tasks, buyer, outcome and tradeoffs. For supplements, test the combined system against the best existing setup, including integration costs and interactions. For alternatives, establish why a customer would switch. For different uses, establish why current options do not fit.
- **Investment case:** strongest plausible case, strongest objection, and evidence that would change the judgment. Separate exploration priority from investment readiness. Do not demand proven demand before allowing investigation, or present potential demand as proven.

Reuse prior sources, but label older reports as written under earlier instructions. Do not automatically rerun completed phases, rewrite original reports or promote a signal. Instruction versions belong in research input identity so old output cannot silently replay as a new assessment.

## Review and feedback

Reviewers must check whether an incumbent objection establishes actual overlap or merely names a product in the same category. Any claim that an alternative closes the opportunity needs a comparison; otherwise record additional value as unresolved.

Feedback changes the general reasoning rule, not just topic preferences. The exoskeleton example teaches adjacent-use exploration, not automatic preference for aging. The AI-cost example teaches functional comparison, not automatic preference for supplements. Preserve contrary evidence.

Research starts or resumes only with explicit user authorization. Updating these instructions alone does not start discovery, research, review or publication.
