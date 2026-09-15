# Quick research: international certification practice

Research date: 2026-09-14. Decision: where QuizTrainer plus the Scraping ingestion pipeline can first earn revenue from individual learners of international IT certifications. Initial comparison is AWS certification practice in English; this is a launch wedge, not a claim that the total market is limited to AWS. Method: current official certification and competitor pages, Pearson VUE's candidate survey, a small set of first-person learner discussions, and the two local repositories. No paid traffic, sales, search-volume, or willingness-to-pay data was available.

## Decision

Do not launch a generic 65-question CLF-C02 pack at the previously proposed $9–12 as though it were competitive. Existing sellers offer several full exams, explanations, references, progress tools, and free samples at about $15. Test a narrower proposition first: help SAA-C03 learners review *wrong and uncertain* answers, understand why alternatives fail, and choose the next topic to study. Use a small set of original or explicitly licensed practice items for the test. This workflow is a **hypothesis**, not a verified market gap; competitors already provide review modes, explanations, and section reports. If learner testing does not show a clear advantage, reconsider the proposition before building a paid platform.

## Demand signals and limits

- AWS reported more than 1.42 million active certifications held by 1.05 million individuals as of January 2025. This shows a large installed certification base, **not** annual exam demand or the addressable market for QuizTrainer. [AWS Certification](https://aws.amazon.com/certification/).
- Pearson VUE's 2025 candidate report analyzed 23,714 responses across 150 countries from candidates who took a Pearson VUE exam between March 2023 and March 2024. In that respondent group, 49% named cloud computing among future specialty interests; 84% said they were likely or very likely to seek another certification in the following 12 months; self-directed preparation rose from 28% to 33% in the survey's comparison. These are self-reported intentions and behaviors of responding test takers, not market size or purchase intent for this product. [Pearson VUE 2025 Candidate Report, pp. 39–41, 46](https://www.pearsonvue.com/content/dam/VUE/vue/en/documents/voc/pearson-vue-2025-value-of-certification-report.pdf).
- First-person learner posts describe reviewing wrong, guessed, and even correct-but-uncertain answers, and concern that repeat scores reflect memorization. These are useful interview prompts, not representative prevalence estimates. [March 2026 learner account](https://www.reddit.com/r/AWSCertifications/comments/1s4f083/i_kept_failing_practice_exams_but_still_passed/), [February 2025 learner question](https://www.reddit.com/r/AWSCertifications/comments/1in3ao2).

## Competitor comparison

Prices and offers were checked on 2026-09-14; promotions can change.

| Offer | Observed package and price | Implication |
| --- | --- | --- |
| AWS Skill Builder | Free official 20-question practice sets; individual subscription from $29/month includes official practice exams and other training. [AWS exam preparation](https://aws.amazon.com/certification/certification-prep/) | The first free sample must be meaningfully useful; an "official" claim is unavailable to an independent product. |
| Tutorials Dojo CLF-C02 | $14.99; six timed exam sets, review and section modes, explanations, reference links, flashcards, and a progress report. Vendor-reported feature list. [Product page](https://portal.tutorialsdojo.com/courses/aws-certified-cloud-practitioner-practice-exams/) | A small generic bank with explanations is already behind the standard offer on breadth. |
| Whizlabs CLF-C02 | Practice tests displayed at $15.95 promotional price; vendor claims four full exams and 300+ practice questions, plus a free test. [Product page](https://www.whizlabs.com/aws-certified-cloud-practitioner/) | Question volume and trial access are established competitive expectations. |

None of those pages proves what customers actually pay after discounts or how many convert. They do show that QuizTrainer's current practice/timed/flashcard modes alone are not a clear differentiator.

## Product and channel implications

The local Scraping output has 4,485 questions across 11 exam-code JSON files. The exported schema matches QuizTrainer's JSON import, but none of those output questions has an explanation in the fields the trainer displays; 15 MLA-C01 questions have no `is_correct` choice. QuizTrainer stores quizzes and history in browser IndexedDB and has no account, payment, or cross-device history. [Scraping README](../../../Scraping/README.md), [question DTO](../../../Scraping/core/dto.py), [QuizTrainer import](../../index.js), [QuizTrainer storage](../../db.js). Counts were computed from local `result/questions/*/questions.json` on the research date.

The catalog also needs version checks before any public promise: AWS has announced the transition from MLA-C01 to MLA-C02, with the English MLA-C01 exam ending September 28, 2026. [AWS announcement](https://aws.amazon.com/blogs/training-and-certification/updates-to-aws-certified-machine-learning-engineer-associate-mla-c02/). The existing dataset count must not be presented as the number of sellable, current questions. Confirm that any marketed item is original or licensed for commercial distribution and is not disclosed actual exam content; AWS warns against unauthorized exam items. [AWS certification security guidance](https://aws.amazon.com/blogs/training-and-certification/protecting-aws-certification-value-through-security-measures/).

For acquisition, test a certification-specific page and a useful free diagnostic with direct invitations to relevant learners. Search volume, acquisition cost, conversion rate, and willingness to pay are **unknown**; no paid campaign or channel ranking is justified by this desk research. Communities can help recruit interviews where their rules allow, but a handful of posts does not establish a scalable channel.

## Smallest useful experiment

1. Recruit 10–15 people actively preparing for SAA-C03 in the next 60 days. Observe how they review missed and guessed questions in their current tools, and ask what they already bought. Do not treat stated interest as proof of willingness to pay.
2. Offer a 15–20-question, rights-cleared diagnostic with explicit confidence marking, answer elimination rationale, current AWS reference links, and a next-topic recommendation. Compare it with each participant's current review workflow. This is a prototype scope, not a proposed full paid exam bank.
3. If at least 5 participants say the review saved them meaningful study time **and** at least 3 actually pay for a pilot or available offer, build the smallest paid product around that demonstrated behavior. The thresholds are internal decision rules, not industry benchmarks. If the result is weaker, test another audience or offer before adding subscriptions or a broader catalog.

Unresolved: whether written commercial rights cover the existing 4,485 scraped questions or whether the commercial bank will consist entirely of newly authored content. This changes the content-production path, not the market findings above.
