const LADO_MAXIMO_PADRAO = 480
const QUALIDADE_PADRAO = 0.82

// Redimensiona a imagem no próprio navegador antes de virar base64 -- sem
// isso, uma foto de celular facilmente estoura o limite de 1MiB por
// documento do Firestore. Usado tanto no retrato do personagem quanto na
// imagem de capa da campanha.
export function redimensionarImagem(arquivo, ladoMaximo = LADO_MAXIMO_PADRAO, qualidade = QUALIDADE_PADRAO) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    leitor.onload = () => {
      const imagem = new Image()
      imagem.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      imagem.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height))
        const largura = Math.round(imagem.width * escala)
        const altura = Math.round(imagem.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        canvas.getContext('2d').drawImage(imagem, 0, 0, largura, altura)
        resolve(canvas.toDataURL('image/jpeg', qualidade))
      }
      imagem.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}
