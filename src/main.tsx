import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initAuth } from './state';
import './styles.css';

// GitHub Pages non permette l'intestazione frame-ancestors: blocchiamo
// l'inclusione in iframe di altri siti (clickjacking) lato script.
if (window.top !== window.self) {
  document.body.textContent = 'RisparmIA non può essere aperta dentro un altro sito.';
  throw new Error('framed');
}

registerSW({ immediate: true });
initAuth();
render(<App />, document.getElementById('app')!);
