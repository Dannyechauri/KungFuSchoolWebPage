const zodiacAnimals = [
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
]

function ZodiacSequence({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="zodiac-sequence" aria-hidden={hidden || undefined}>
      {zodiacAnimals.map((animal) => (
        <div className="zodiac-animal" key={animal.name}>
          <img src={animal.image} alt={hidden ? '' : animal.name} />
          <span aria-hidden="true">{animal.character}</span>
        </div>
      ))}
      <div className="zodiac-divider">
        <img
          src="/zodiac/pakua.svg"
          alt={hidden ? '' : 'Pakua con yin-yang y ocho trigramas'}
        />
      </div>
    </div>
  )
}

export function ZodiacCarousel() {
  return (
    <section className="zodiac-carousel" aria-label="Los doce animales del zodiaco chino">
      <div className="zodiac-marquee">
        <ZodiacSequence />
        <ZodiacSequence hidden />
        <ZodiacSequence hidden />
      </div>
    </section>
  )
}
