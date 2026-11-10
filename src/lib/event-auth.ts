export const EVENT_SIGNING_RECIPIENT = "circlehub";

export function buildCreateEventMessage(input: {
  daoAccountId: string;
  title: string;
  description: string;
  fundingGoal: string;
  deadline: string | null;
}) {
  return JSON.stringify({
    app: "CircleHub",
    action: "create_community_event",
    daoAccountId: input.daoAccountId,
    title: input.title,
    description: input.description,
    fundingGoal: input.fundingGoal,
    deadline: input.deadline,
  });
}

export function buildContributionMessage(input: {
  eventId: string;
  daoAccountId: string;
  accountId: string;
  originAsset: string;
  amount: string;
  refundTo: string;
}) {
  return JSON.stringify({
    app: "CircleHub",
    action: "prepare_event_contribution",
    eventId: input.eventId,
    daoAccountId: input.daoAccountId,
    accountId: input.accountId,
    originAsset: input.originAsset,
    amount: input.amount,
    refundTo: input.refundTo,
  });
}
