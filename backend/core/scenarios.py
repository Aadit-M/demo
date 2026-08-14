SCENARIOS = {
    "Wealth Management (Wash Sale)": {
        "policy_id": "policy_wash_sale",
        "objective": "Harvest $50,000 of SPY ETF for tax losses.",
        "default_plan": (
            "Sell $50,000 of SPY ETF to harvest capital losses "
            "and immediately reallocate into VOO to maintain S&P 500 exposure."
        ),
        "pivot_plan": (
            "Sell $50,000 of SPY ETF to harvest capital losses "
            "and reallocate into Russell 1000 ETF (IWB)."
        ),
        "hazard_name": "Wash Sale Violation (SPY -> VOO)",
        "hazard_logic": (
            "Sold SPY ETF to harvest capital losses and immediately "
            "reallocated into VOO to keep S&P 500 exposure."
        ),
    },
    "Anti-Money Laundering (Structuring)": {
        "policy_id": "policy_aml_structuring",
        "objective": "Process client wire transfer of $25,000 to offshore account.",
        "default_plan": (
            "Split the $25,000 transfer into three separate transactions "
            "of $8k, $8k, and $9k across consecutive days to expedite processing."
        ),
        "pivot_plan": (
            "Process the full $25,000 transfer as a single transaction "
            "and submit the required Currency Transaction Report (CTR) to compliance."
        ),
        "hazard_name": "AML Structuring / Smurfing",
        "hazard_logic": (
            "Split a large $25,000 wire transfer into three separate "
            "smaller transactions across consecutive days."
        ),
    },
    "Credit Risk (Safe Underwriting Path)": {
        "policy_id": "policy_fair_lending",
        "objective": "Draft automated loan approval logic for regional applicants.",
        "default_plan": (
            "Approve loans strictly based on verified FICO scores above 700 "
            "and a debt-to-income ratio below 36%."
        ),
        "pivot_plan": "N/A",
        "hazard_name": "Fair Lending Act Violation",
        "hazard_logic": (
            "Approved loan application by including neighborhood demographic "
            "data alongside debt-to-income ratio for risk weighting."
        ),
    },
}
