const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lottery Contract", function () {
  let Lottery, lottery, manager, addr1, addr2, addrs;
  const ticketPrice = ethers.parseEther("0.01");

  beforeEach(async function () {
    // Otteniamo gli account (signers)
    [manager, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy del contratto da parte del manager
    Lottery = await ethers.getContractFactory("LotteryWithTickets");
    lottery = await Lottery.connect(manager).deploy();
    await lottery.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Dovrebbe impostare il manager correttamente", async function () {
      expect(await lottery.manager()).to.equal(manager.address);
    });
  });

  describe("Acquisto Biglietti", function () {
    it("Permette a un utente di acquistare un singolo biglietto inviando esattamente il prezzo", async function () {
      await lottery.connect(addr1).buyTickets({ value: ticketPrice });
      const tickets = await lottery.getTickets();
      expect(tickets.length).to.equal(1);
      expect(tickets[0]).to.equal(addr1.address);
    });

    it("Permette a un utente di acquistare più biglietti se invia un multiplo del prezzo", async function () {
      const value = ethers.parseEther("0.03"); // 3 biglietti
      await lottery.connect(addr1).buyTickets({ value });
      const tickets = await lottery.getTickets();
      expect(tickets.length).to.equal(3);
      tickets.forEach(ticket => {
        expect(ticket).to.equal(addr1.address);
      });
    });

    it("Rifiuta l'acquisto se l'importo inviato è inferiore al prezzo di un biglietto", async function () {
      await expect(
        lottery.connect(addr1).buyTickets({ value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Devi inviare almeno il prezzo di un biglietto");
    });

    it("Rifiuta l'acquisto se l'importo non è un multiplo esatto del prezzo del biglietto", async function () {
      await expect(
        lottery.connect(addr1).buyTickets({ value: ethers.parseEther("0.015") })
      ).to.be.revertedWith("L'importo inviato deve essere un multiplo del prezzo del biglietto");
    });
  });

  describe("Selezione del Vincitore", function () {
    beforeEach(async function () {
      // Due partecipanti acquistano biglietti
      await lottery.connect(addr1).buyTickets({ value: ticketPrice }); // 1 biglietto di addr1
      await lottery.connect(addr2).buyTickets({ value: ethers.parseEther("0.02") }); // 2 biglietti di addr2
    });

    it("Permette solo al manager di chiamare pickWinner", async function () {
      await expect(lottery.connect(addr1).pickWinner())
        .to.be.revertedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Trasferisce il saldo del contratto al vincitore e resetta i biglietti", async function () {
      // Il manager chiama pickWinner
      const tx = await lottery.connect(manager).pickWinner();
      await tx.wait();

      // Verifica che l'array dei biglietti sia stato resettato
      const tickets = await lottery.getTickets();
      expect(tickets.length).to.equal(0);

      // Con ethers v6, l'indirizzo del contratto è in lottery.target
      const contractBalance = await ethers.provider.getBalance(lottery.target);
      expect(contractBalance).to.equal(0);
    });
  });
});
