// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Lottery {
    address public manager;
    address[] public players;
    
    constructor() {
        manager = msg.sender;
    }
    
    // Funzione per entrare nella lotteria
    function enter() public payable {
        require(msg.value >= 0.01 ether, "Devi inviare almeno 0.01 ether per partecipare");
        players.push(msg.sender);
    }
    
    // Funzione interna per generare un numero pseudo-casuale
    function random() private view returns (uint) {
        return uint(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, players.length)));//metodo random non sicuro
    }
    
    // Modificatore per limitare l'accesso al manager
    modifier restricted() {
        require(msg.sender == manager, "Solo il manager puo' chiamare questa funzione");
        _;
    }
    
    // Funzione per selezionare il vincitore
    function pickWinner() public restricted {
        require(players.length > 0, "Non ci sono partecipanti");
        
        uint index = random() % players.length;
        address winner = players[index];
        
        payable(winner).transfer(address(this).balance);
        
        // Resetta l'array dei partecipanti per la prossima edizione della lotteria
        players = new address[](0);
    }
    
    // Funzione per ottenere la lista dei partecipanti
    function getPlayers() public view returns (address[] memory) {
        return players;
    }
}
