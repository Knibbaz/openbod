export function Uitleg() {
  return (
    <div>
      <h1>Hoe werkt de verzegeling?</h1>
      <ol>
        <li>
          <strong>Verzegelen (in jouw browser).</strong> Je bod wordt versleuteld met een timelock naar het publieke
          drand quicknet-netwerk, gekoppeld aan de sluitingsronde. Zie <code>packages/web-demo/src/lib/seal.ts</code>.
        </li>
        <li>
          <strong>Opslaan.</strong> De server (<code>packages/core</code>) ontvangt alleen een hash (commitment) en
          de versleutelde inhoud. Zie <code>packages/core/src/store.ts</code>.
        </li>
        <li>
          <strong>Onthullen op de deadline.</strong> Zodra drand de rondesleutel publiceert, kan iedereen ontsleutelen
          — ook deze server, pas op dat moment. Zie <code>packages/core/src/reveal/reveal.ts</code>.
        </li>
        <li>
          <strong>Onwrikbaar logboek.</strong> Elke gebeurtenis staat in een hashketen. Wijzigen breekt de keten
          zichtbaar. Zie <code>packages/core/src/log/hashchain.ts</code>.
        </li>
        <li>
          <strong>Zelf verifiëren.</strong> Geloof dit niet op ons woord: <code>packages/verifier</code> is een losse
          CLI die het logboek en je ontvangstbewijs controleert zonder deze server te vertrouwen.
        </li>
      </ol>
      <p>
        Volledige spec: <code>spec/protocol.md</code>. Architectuur: <code>ARCHITECTURE.md</code>.
      </p>
    </div>
  );
}
