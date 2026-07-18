import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (user) => {
      setUsuario(user)
      setCarregando(false)
    })
    return cancelar
  }, [])

  async function entrar(email, senha) {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function cadastrar(nome, email, senha) {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha)

    // O nome NAO precisa ser unico. Quem identifica o usuario de verdade
    // pro resto do sistema (fichas, campanhas, permissoes de mestre) e
    // sempre o uid (credencial.user.uid) -- nunca o nome de exibicao.
    // Duas pessoas podem se chamar "Kel" sem nenhum conflito.
    await updateProfile(credencial.user, { displayName: nome })

    await setDoc(doc(db, 'usuarios', credencial.user.uid), {
      nome,
      criado_em: serverTimestamp(),
    })

    // updateProfile nao dispara onAuthStateChanged sozinho em todo browser;
    // atualiza o estado local na hora pra nao esperar o proximo evento.
    setUsuario({ ...credencial.user, displayName: nome })
  }

  async function sair() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, cadastrar, sair }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return contexto
}
