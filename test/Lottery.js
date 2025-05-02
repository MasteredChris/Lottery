const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LotteryWithTickets Contract", function () {
  let LotteryWithTickets, lottery, manager, addr1, addr2, addrs;

  beforeEach(async function () {
    // Recupera gli account (signers)
    [manager, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Usa il nome qualificato completo per il contratto in LotteryWithTickets.sol
    LotteryWithTickets = await ethers.getContractFactory("contracts/LotteryWithTickets.sol:Lottery");
    lottery = await LotteryWithTickets.connect(manager).deploy();
    await lottery.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Dovrebbe impostare il manager corretto", async function () {
      expect(await lottery.manager()).to.equal(manager.address);
    });
  });

  describe("Entrare nella lotteria", function () {
    it("Dovrebbe permettere a un giocatore di partecipare inviando almeno 0.01 ether", async function () {
      await lottery.connect(addr1).enter({ value: ethers.parseEther("0.01") });
      const players = await lottery.getPlayers();
      expect(players).to.include(addr1.address);
    });

    it("Dovrebbe fallire se l'importo inviato è inferiore a 0.01 ether", async function () {
      await expect(
        lottery.connect(addr1).enter({ value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Devi inviare almeno 0.01 ether per partecipare");
    });
  });

  describe("Selezione del vincitore", function () {
    beforeEach(async function () {
      // Inseriamo due giocatori
      await lottery.connect(addr1).enter({ value: ethers.parseEther("0.01") });
      await lottery.connect(addr2).enter({ value: ethers.parseEther("0.01") });
    });

    it("Dovrebbe permettere solo al manager di chiamare pickWinner", async function () {
      await expect(lottery.connect(addr1).pickWinner())
        .to.be.revertedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Dovrebbe trasferire il saldo del contratto al vincitore e resettare i partecipanti", async function () {
      // Il manager chiama pickWinner
      const tx = await lottery.connect(manager).pickWinner();
      await tx.wait();

      // Verifichiamo che l'array dei giocatori sia stato resettato
      const players = await lottery.getPlayers();
      expect(players.length).to.equal(0);

      // Verifichiamo che il saldo del contratto sia pari a 0
      const contractBalance = await ethers.provider.getBalance(lottery.target);
      expect(contractBalance).to.equal(0);
    });
  });
});
