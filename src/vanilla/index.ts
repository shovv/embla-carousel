import { Engine } from './components/engine'
import { EventEmitter, EmblaEvent } from './components/eventEmitter'
import { EventStore } from './components/eventStore'
import { defaultOptions, EmblaOptions } from './components/options'
import {
  addClass,
  arrayFromCollection,
  debounce,
  removeClass,
} from './components/utils'

export type EmblaCarousel = {
  canScrollNext: () => boolean
  canScrollPrev: () => boolean
  clickAllowed: () => boolean
  containerNode: () => HTMLElement
  dangerouslyGetEngine: () => Engine
  destroy: () => void
  off: EventEmitter['off']
  on: EventEmitter['on']
  previousScrollSnap: () => number
  reInit: (options?: EmblaOptions) => void
  scrollNext: () => void
  scrollPrev: () => void
  scrollProgress: () => number
  scrollSnapList: () => number[]
  scrollTo: (index: number) => void
  selectedScrollSnap: () => number
  slideNodes: () => HTMLElement[]
  slidesInView: (target?: boolean) => number[]
  slidesNotInView: (target?: boolean) => number[]
}

function EmblaCarousel(
  sliderRoot: HTMLElement,
  userOptions?: EmblaOptions,
): EmblaCarousel {
  const events = EventEmitter()
  const eventStore = EventStore()
  const debouncedResize = debounce(resize, 500)
  const reInit = reActivate
  const { on, off } = events

  let engine: Engine
  let activated = false
  let options = Object.assign({}, defaultOptions)
  let rootElementSize = 0
  let container: HTMLElement
  let slides: HTMLElement[]

  activate(userOptions)

  function storeElements(): void {
    if (!sliderRoot) throw new Error('Missing root node 😢')

    const selector = options.containerSelector
    const sliderContainer = sliderRoot.querySelector(selector)

    if (!sliderContainer) throw new Error('Missing container node 😢')

    container = sliderContainer as HTMLElement
    slides = arrayFromCollection(container.children)
  }

  function activate(partialOptions?: EmblaOptions): void {
    storeElements()
    options = Object.assign(options, partialOptions)
    engine = Engine(sliderRoot, container, slides, options, events)
    rootElementSize = engine.axis.measure(sliderRoot)
    eventStore.add(window, 'resize', debouncedResize)
    engine.translate.to(engine.location)

    if (options.loop) {
      if (!engine.slideLooper.canLoop()) {
        deActivate()
        return activate({ loop: false })
      }
      engine.slideLooper.loop(slides)
    }
    if (options.draggable && slides.length) {
      engine.dragHandler.addActivationEvents()
      if (options.draggableClass) {
        addClass(sliderRoot, options.draggableClass)
      }
      if (options.draggingClass) {
        events
          .on('pointerDown', toggleDraggingClass)
          .on('pointerUp', toggleDraggingClass)
      }
    }
    if (slides.length) {
      engine.slideFocus.addActivationEvents(slides)
    }
    if (options.selectedClass) {
      toggleSelectedClass()
      events
        .on('select', toggleSelectedClass)
        .on('pointerUp', toggleSelectedClass)
    }
    if (!activated) {
      setTimeout(() => events.emit('init'), 0)
      activated = true
    }
  }

  function toggleDraggingClass(evt: EmblaEvent): void {
    const { draggingClass } = options
    if (evt === 'pointerDown') addClass(sliderRoot, draggingClass)
    else removeClass(sliderRoot, draggingClass)
  }

  function toggleSelectedClass(): void {
    const { selectedClass } = options
    const inView = slidesInView(true)
    const notInView = slidesNotInView(true)
    notInView.forEach(i => removeClass(slides[i], selectedClass))
    inView.forEach(i => addClass(slides[i], selectedClass))
  }

  function deActivate(): void {
    engine.dragHandler.removeAllEvents()
    engine.slideFocus.removeAllEvents()
    engine.animation.stop()
    eventStore.removeAll()
    engine.translate.clear()
    engine.slideLooper.clear(slides)
    removeClass(sliderRoot, options.draggableClass)
    slides.forEach(s => removeClass(s, options.selectedClass))
    events.off('select', toggleSelectedClass)
    events.off('pointerUp', toggleSelectedClass)
    events.off('pointerDown', toggleDraggingClass)
    events.off('pointerUp', toggleDraggingClass)
  }

  function reActivate(partialOptions?: EmblaOptions): void {
    if (!activated) return
    const startIndex = selectedScrollSnap()
    const newOptions = Object.assign({ startIndex }, partialOptions)
    deActivate()
    activate(newOptions)
    events.emit('reInit')
  }

  function destroy(): void {
    if (!activated) return
    deActivate()
    activated = false
    events.emit('destroy')
  }

  function resize(): void {
    if (!activated) return
    const newRootElementSize = engine.axis.measure(sliderRoot)
    if (rootElementSize !== newRootElementSize) reActivate()
    events.emit('resize')
  }

  function slidesInView(target?: boolean): number[] {
    const location = engine[target ? 'target' : 'location'].get()
    const type = options.loop ? 'removeOffset' : 'constrain'
    return engine.slidesInView.check(engine.limit[type](location))
  }

  function slidesNotInView(target?: boolean): number[] {
    const inView = slidesInView(target)
    return engine.slideIndexes.filter(i => inView.indexOf(i) === -1)
  }

  function scrollTo(index: number, direction?: number): void {
    engine.scrollBody.useBaseMass().useBaseSpeed()
    if (activated) engine.scrollTo.index(index, direction || 0)
  }

  function scrollNext(): void {
    const next = engine.index.clone().add(1)
    scrollTo(next.get(), -1)
  }

  function scrollPrev(): void {
    const prev = engine.index.clone().add(-1)
    scrollTo(prev.get(), 1)
  }

  function canScrollNext(): boolean {
    const next = engine.index.clone().add(1)
    return next.get() !== selectedScrollSnap()
  }

  function canScrollPrev(): boolean {
    const prev = engine.index.clone().add(-1)
    return prev.get() !== selectedScrollSnap()
  }

  function scrollSnapList(): number[] {
    return engine.scrollSnaps.map(engine.scrollProgress.get)
  }

  function scrollProgress(): number {
    return engine.scrollProgress.get(engine.location.get())
  }

  function selectedScrollSnap(): number {
    return engine.index.get()
  }

  function previousScrollSnap(): number {
    return engine.indexPrevious.get()
  }

  function clickAllowed(): boolean {
    return engine.dragHandler.clickAllowed()
  }

  function dangerouslyGetEngine(): Engine {
    return engine
  }

  function containerNode(): HTMLElement {
    return container
  }

  function slideNodes(): HTMLElement[] {
    return slides
  }

  const self: EmblaCarousel = {
    canScrollNext,
    canScrollPrev,
    clickAllowed,
    containerNode,
    dangerouslyGetEngine,
    destroy,
    off,
    on,
    previousScrollSnap,
    reInit,
    scrollNext,
    scrollPrev,
    scrollProgress,
    scrollSnapList,
    scrollTo,
    selectedScrollSnap,
    slideNodes,
    slidesInView,
    slidesNotInView,
  }
  return self
}

export default EmblaCarousel
