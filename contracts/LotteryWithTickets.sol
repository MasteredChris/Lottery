// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LotteryWithTickets {
    // L'indirizzo del manager (chi deploya il contratto)
    address public manager;
    // Array dei biglietti; ogni biglietto corrisponde all'indirizzo dell'acquirente.
    // Se un utente acquista più biglietti, il suo indirizzo apparirà più volte.
    address[] public tickets;
    
    // Prezzo di un singolo biglietto (0.01 ether)
    uint public ticketPrice = 0.01 ether;

    // Il costruttore imposta il manager al momento del deploy
    constructor() {
        manager = msg.sender;
    }

    /**
     * @dev Funzione per acquistare biglietti.
     * L'utente deve inviare un importo maggiore o uguale al prezzo di un biglietto,
     * e l'importo inviato deve essere un multiplo di ticketPrice.
     */
    function buyTickets() public payable {
        require(msg.value >= ticketPrice, "Devi inviare almeno il prezzo di un biglietto");
        require(msg.value % ticketPrice == 0, "L'importo inviato deve essere un multiplo del prezzo del biglietto");
        uint numberOfTickets = msg.value / ticketPrice;
        for (uint i = 0; i < numberOfTickets; i++) {
            tickets.push(msg.sender);
        }
    }

    /**
     * @dev Funzione privata per generare un numero pseudo-casuale.
     * NOTA: Non usare questo metodo per applicazioni in produzione.
     */
    function random() private view returns (uint) {
        return uint(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, tickets.length)));
    }

    /**
     * @dev Modificatore per limitare alcune funzioni al solo manager.
     */
    modifier restricted() {
        require(msg.sender == manager, "Solo il manager puo' chiamare questa funzione");
        _;
    }

    /**
     * @dev Funzione per scegliere il vincitore.
     * Solo il manager può chiamarla; seleziona un biglietto a caso, trasferisce l'intero saldo
     * del contratto al vincitore e resetta l'array dei biglietti per la prossima edizione.
     */
    function pickWinner() public restricted {
        require(tickets.length > 0, "Non ci sono biglietti acquistati");
        uint index = random() % tickets.length;
        address winner = tickets[index];

        payable(winner).transfer(address(this).balance);

        // Reset dei biglietti per una nuova edizione della lotteria
        tickets = new address[](0);
    }

    /**
     * @dev Funzione per visualizzare i biglietti acquistati.
     */
    function getTickets() public view returns (address[] memory) {
        return tickets;
    }
}
