/* 中美 AI 投资
 * 单位：十亿美元（USD billion）。数字只来自研究稿，页面不另算总数。
 * 私人资本和国家 / 公共资本口径不同，不能画进同一组可比柱。
 * chart_ready_rows 供分图使用。
 * private_capital、state_or_public_capital 提供口径、出处，以及没有进入可比柱的条目
 * （美国资助合同合计、中国 2025 年宣布的基金、生成式投资、新公司家数）。
 */
window.AI_CAPITAL = {
  meta: {
    as_of: "2026-10-11",
    primary_source: "Stanford HAI AI Index Report 2026 (Quid private investment)",
    unit: "USD_billion",
    private_definition: "AI/ML companies with >$1.5M funding; private investment (VC/PE etc.), excludes most government-backed funding",
    caveat: "Do not add private + state rows into one total without labeling incomparable definitions."
  },
  private_capital: {
    annual: [
      { year: 2024, US: 109.1, China: 9.3, source: "Stanford AI Index 2025 Economy", url: "https://hai.stanford.edu/ai-index/2025-ai-index-report/economy" },
      { year: 2025, US: 285.88, China: 12.41, ratio_US_to_China: 23.1, source: "Stanford AI Index 2026", url: "https://hai.stanford.edu/ai-index/2026-ai-index-report/economy" }
    ],
    cumulative_2013_2025: { US: 757.27, China: 131.83, source: "Stanford AI Index 2026 Fig 4.2.12" },
    generative_AI_private_2025: { global: 170.9, US: 163.6, China_plus_Europe: 4.7 },
    global_private_2025: 344.66,
    newly_funded_AI_companies_2025: { US: 1953, China: 161 }
  },
  state_or_public_capital: {
    US_federal_AI_RD_NITRD_nondefense: {
      FY2023_actual: 3.122,
      FY2024_enacted: 2.978,
      FY2025_request: 3.316,
      url: "https://www.nitrd.gov/ai-rd-investments/"
    },
    US_AI_related_contracts_grants_OTAs_2013_2024: {
      total: 20.5,
      grants: 15.9,
      contracts: 3.9,
      OTAs: 0.65,
      source: "Stanford AI Index 2026 Policy chapter"
    },
    China_government_guidance_funds_to_AI_firms: {
      period: "2000-2023",
      estimated_AI_allocation: 184,
      all_industries_guidance_funds_deployed: 912,
      source: "Stanford AI Index 2026"
    },
    China_announced_state_VC_fund_2025: {
      amount: 138,
      announced: "2025-03",
      scope: "AI and other cutting-edge technologies (announcement; not equal to deployed AI spend)"
    }
  },
  chart_ready_rows: [
    { series: "private_annual", year: 2024, country: "US", value_usd_bn: 109.1, capital_type: "private" },
    { series: "private_annual", year: 2024, country: "China", value_usd_bn: 9.3, capital_type: "private" },
    { series: "private_annual", year: 2025, country: "US", value_usd_bn: 285.88, capital_type: "private" },
    { series: "private_annual", year: 2025, country: "China", value_usd_bn: 12.41, capital_type: "private" },
    { series: "private_cumulative_2013_2025", country: "US", value_usd_bn: 757.27, capital_type: "private" },
    { series: "private_cumulative_2013_2025", country: "China", value_usd_bn: 131.83, capital_type: "private" },
    { series: "US_NITRD_AI_RD", year: 2023, value_usd_bn: 3.122, capital_type: "public_nondefense_RD" },
    { series: "US_NITRD_AI_RD", year: 2024, value_usd_bn: 2.978, capital_type: "public_nondefense_RD" },
    { series: "US_NITRD_AI_RD", year: 2025, value_usd_bn: 3.316, capital_type: "public_nondefense_RD_request" },
    { series: "China_guidance_funds_AI_cumulative", period: "2000-2023", value_usd_bn: 184, capital_type: "state_guidance_funds" }
  ]
};
