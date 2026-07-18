import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  linkWithCredential,
  linkWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'

const AuthContext = createContext(null)
const provedorGoogle = new GoogleAuthProvider()

// Cria o doc usuarios/{uid} só se ainda não existir -- assim `criado_em`
// nunca é sobrescrito em logins/vínculos seguintes, e um mesmo uid (ex.:
// visitante que virou conta de verdade) mantém a data original.
async function garantirDocUsuario(user, nomePadrao) {
  const ref = doc(db, 'usuarios', user.uid)
  const existente = await getDoc(ref)
  if (!existente.exists()) {
    await setDoc(ref, { nome: user.displayName || nomePadrao, criado_em: serverTimestamp() })
  }
}

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

  async function entrarComGoogle() {
    const credencial = await signInWithPopup(auth, provedorGoogle)
    await garantirDocUsuario(credencial.user, 'Aventureiro')
    setUsuario(credencial.user)
  }

  // Login sem cadastro nenhum -- pra quem quer testar o sistema ou jogar
  // uma one-shot sem colocar a conta pessoal. O Firebase gera um uid
  // normal pra esse usuário (só que com `isAnonymous: true`), então
  // personagens/campanhas criados nessa sessão funcionam igual aos de
  // qualquer outra conta -- e podem ser "promovidos" depois com
  // vincularEmail/vincularGoogle, sem perder nada.
  async function entrarAnonimo() {
    const credencial = await signInAnonymously(auth)
    await garantirDocUsuario(credencial.user, 'Visitante')
    setUsuario(credencial.user)
  }

  // Transforma a conta anônima atual numa conta de email/senha de verdade,
  // MANTENDO o mesmo uid -- é por isso que se usa linkWithCredential em vez
  // de criar uma conta nova: os personagens e campanhas já criados
  // continuam apontando pro mesmo dono_uid.
  async function vincularEmail(nome, email, senha) {
    if (!auth.currentUser) throw new Error('Nenhum usuário logado.')
    const credencial = EmailAuthProvider.credential(email, senha)
    const resultado = await linkWithCredential(auth.currentUser, credencial)
    await updateProfile(resultado.user, { displayName: nome })
    await setDoc(doc(db, 'usuarios', resultado.user.uid), { nome }, { merge: true })
    setUsuario({ ...resultado.user, displayName: nome })
  }

  // Mesma ideia de vincularEmail, mas associando uma conta Google em vez
  // de email/senha.
  async function vincularGoogle() {
    if (!auth.currentUser) throw new Error('Nenhum usuário logado.')
    const resultado = await linkWithPopup(auth.currentUser, provedorGoogle)
    const nome = resultado.user.displayName || 'Aventureiro'
    await setDoc(doc(db, 'usuarios', resultado.user.uid), { nome }, { merge: true })
    setUsuario({ ...resultado.user, displayName: nome })
  }

  async function sair() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, entrar, cadastrar, entrarComGoogle, entrarAnonimo, vincularEmail, vincularGoogle, sair }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return contexto
}
