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
      const receipt = await tx.wait();

      const iface = lottery.interface;
      const logs = receipt.logs.map(log => iface.parseLog(log));
      const winnerEvent = logs.find(log => log.name === "WinnerSelected");

      expect(winnerEvent).to.not.be.undefined;
      const winner = winnerEvent.args.winner;
      const prize = winnerEvent.args.prize;

      const pending = await lottery.pendingWithdrawals(winner);
      expect(pending).to.equal(prize);


      // Verifica che l'array dei biglietti sia stato resettato
      const tickets = await lottery.getTickets();
      expect(tickets.length).to.equal(0);

      // Verifica che il contratto abbia ancora i fondi (pull-payment pattern)
      const contractBalance = await ethers.provider.getBalance(lottery.target);
      expect(contractBalance).to.equal(prize);
    });
  });

  describe("Funzione withdraw", function () {
    let Lottery, lottery, manager, addr1, addr2;
    const ticketPrice = ethers.parseEther("0.01");
  
    beforeEach(async function () {
      [manager, addr1, addr2] = await ethers.getSigners();
      Lottery = await ethers.getContractFactory("LotteryWithTickets");
      lottery = await Lottery.connect(manager).deploy();
      await lottery.waitForDeployment();
    });
  
    it("Dovrebbe rifiutare il prelievo se non ci sono fondi disponibili", async function () {
      await expect(lottery.connect(addr1).withdraw()).to.be.revertedWith("Nessun fondo da prelevare");
    });
  
    it("Dovrebbe permettere al vincitore di prelevare i fondi", async function () {
      // Acquisto biglietti
      await lottery.connect(addr1).buyTickets({ value: ticketPrice });
      await lottery.connect(addr2).buyTickets({ value: ethers.parseEther("0.02") });
  
      // Selezione vincitore
      const tx = await lottery.connect(manager).pickWinner();
      const receipt = await tx.wait();
  
      // Estrazione dell'evento WinnerSelected
      const logs = receipt.logs
        .map(log => {
          try {
            return lottery.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(log => log !== null);
  
      const winnerEvent = logs.find(log => log.name === "WinnerSelected");
      expect(winnerEvent).to.not.be.undefined;
  
      const winner = winnerEvent.args.winner;
      const prize = winnerEvent.args.prize;
  
      // Verifica che il vincitore possa prelevare
      const initialBalance = await ethers.provider.getBalance(winner);
      const withdrawTx = await lottery.connect(await ethers.getSigner(winner)).withdraw();
      const withdrawReceipt = await withdrawTx.wait();
      const gasUsed = BigInt(withdrawReceipt.gasUsed) * BigInt(withdrawTx.gasPrice);
      const finalBalance = await ethers.provider.getBalance(winner);
  
      expect(finalBalance).to.equal(initialBalance + prize - gasUsed);
  
      // Verifica che i fondi siano stati azzerati
      const pending = await lottery.pendingWithdrawals(winner);
      expect(pending).to.equal(0);
    });
  
    it("Dovrebbe impedire un doppio prelievo", async function () {
      // Acquisto biglietti
      await lottery.connect(addr1).buyTickets({ value: ticketPrice });
      await lottery.connect(addr2).buyTickets({ value: ethers.parseEther("0.02") });
  
      // Selezione vincitore
      const tx = await lottery.connect(manager).pickWinner();
      const receipt = await tx.wait();
  
      // Estrazione dell'evento WinnerSelected
      const logs = receipt.logs
        .map(log => {
          try {
            return lottery.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(log => log !== null);
  
      const winnerEvent = logs.find(log => log.name === "WinnerSelected");
      expect(winnerEvent).to.not.be.undefined;
  
      const winner = winnerEvent.args.winner;
  
      // Primo prelievo
      await lottery.connect(await ethers.getSigner(winner)).withdraw();
  
      // Secondo prelievo dovrebbe fallire
      await expect(
        lottery.connect(await ethers.getSigner(winner)).withdraw()
      ).to.be.revertedWith("Nessun fondo da prelevare");
    });
  });
  
});