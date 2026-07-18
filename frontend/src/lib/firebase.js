import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Config do Firebase Client SDK -- diferente da serviceAccountKey.json do
// backend. Essa aqui e publica por natureza (nao e segredo): quem protege
// os dados de verdade sao as Security Rules do Firestore, nao o sigilo
// desses valores. Ainda assim, ficam em variaveis de ambiente por boa
// pratica e pra nao precisar mudar codigo entre ambientes.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
