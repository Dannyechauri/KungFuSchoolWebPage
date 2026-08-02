const zodiacItems = [
  { name: 'Rata', character: '鼠', image: '/zodiac/rat.svg' },
  { name: 'Buey', character: '牛', image: '/zodiac/ox.svg' },
  { name: 'Tigre', character: '虎', image: '/zodiac/tiger.svg' },
  { name: 'Conejo', character: '兔', image: '/zodiac/rabbit.svg' },
  { name: 'Dragón', character: '龍', image: '/zodiac/dragon.svg' },
  { name: 'Serpiente', character: '蛇', image: '/zodiac/snake.svg' },
  { name: 'Caballo', character: '馬', image: '/zodiac/horse.svg' },
  { name: 'Cabra', character: '羊', image: '/zodiac/goat.svg' },
  { name: 'Mono', character: '猴', image: '/zodiac/monkey.svg' },
  { name: 'Gallo', character: '雞', image: '/zodiac/rooster.svg' },
  { name: 'Perro', character: '狗', image: '/zodiac/dog.png' },
  { name: 'Jabalí', character: '豬', image: '/zodiac/boar.png' },
  { name: 'Pakua', character: '卦', image: '/zodiac/pakua.svg' },
];

export function ZodiacRibbon() {
  /**
   * Duplicamos la lista para que la animación CSS pueda hacer un bucle continuo.
   * El usuario no interactúa con esto: es solo un detalle visual del lateral.
   */
  const loopItems = [...zodiacItems, ...zodiacItems];

  return (
    <section className="zodiac-ribbon" aria-hidden="true">
      <div className="zodiac-track">
        {loopItems.map((item, index) => (
          <div className="zodiac-item" key={`${item.name}-${index}`}>
            <img src={item.image} alt="" loading="lazy" />
            <span aria-hidden="true">{item.character}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
