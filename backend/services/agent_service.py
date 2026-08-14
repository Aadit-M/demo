import os
from typing import Optional


DEFAULT_PLANS = {
    "Wealth Management (Wash Sale)": (
        "Sell $50,000 of SPY ETF to harvest capital losses "
        "and immediately reallocate into VOO to maintain S&P 500 exposure."
    ),
    "Anti-Money Laundering (Structuring)": (
        "Split the $25,000 transfer into three separate transactions "
        "of $8k, $8k, and $9k across consecutive days to expedite processing."
    ),
    "Credit Risk (Safe Underwriting Path)": (
        "Approve loans strictly based on verified FICO scores above 700 "
        "and a debt-to-income ratio below 36%."
    ),
}


PIVOT_PLANS = {
    "Wealth Management (Wash Sale)": (
        "Sell $50,000 of SPY ETF to harvest capital losses "
        "and reallocate into Russell 1000 ETF (IWB)."
    ),
    "Anti-Money Laundering (Structuring)": (
        "Process the full $25,000 transfer as a single transaction "
        "and submit the required Currency Transaction Report (CTR) to compliance."
    ),
    "Credit Risk (Safe Underwriting Path)": "N/A",
}


def generate_plan(
    prune_flag: Optional[bool] = None,
    scenario: str = "Wealth Management (Wash Sale)",
    output_path: str = "proposed_plan.txt",
):
    """
    Generate the mock agent strategy for the selected scenario.
    """

    if prune_flag is None:
        prune_flag = os.path.exists(".prune_flag")

    if scenario not in DEFAULT_PLANS:
        raise ValueError(f"Unknown scenario: {scenario}")

    if prune_flag:
        plan = PIVOT_PLANS[scenario]
        status = "pivot"
        message = "Pivot Strategy Activated"
    else:
        plan = DEFAULT_PLANS[scenario]
        status = "default"
        message = "Generated Default Strategy"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(plan)

    print(f"[MOCK_AGENT] {message}: {plan}")

    return {
        "plan": plan,
        "status": status,
        "message": message,
    }


def run_agent(
    scenario: str,
    prune_flag: Optional[bool] = None,
    output_path: str = "proposed_plan.txt",
):
    """
    Compatibility wrapper used by the FastAPI backend.
    """
    return generate_plan(
        prune_flag=prune_flag,
        scenario=scenario,
        output_path=output_path,
    )


if __name__ == "__main__":
    generate_plan()