import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LotteryWithTicketsModule = buildModule("LotteryWithTicketsModule", (m) => {
  const lotteryWithTickets = m.contract("LotteryWithTickets");
  
  return { lotteryWithTickets };
});

export default LotteryWithTicketsModule;
