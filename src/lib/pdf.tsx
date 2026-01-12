import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

/**
 * Gerador de PDF para fichas de treino
 * Este arquivo contém a lógica para gerar PDFs das fichas de treino usando @react-pdf/renderer
 */

interface Exercicio {
  nome: string
  grupoMuscular: string
  series: number
  repeticoes: string
  carga?: string
  descanso?: string
  observacoes?: string
}

interface FichaTreino {
  nome: string
  objetivo?: string
  observacoes?: string
  exercicios: Exercicio[]
  membro: {
    nome: string
  }
  criadoEm: Date
}

// Estilos para o PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#7c3aed',
    paddingBottom: 10,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    color: '#7c3aed',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoCol: {
    flex: 1,
  },
  infoItem: {
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '12.5%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ddd',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#7c3aed',
    color: 'white',
    padding: 5,
  },
  tableCol: {
    width: '12.5%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ddd',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableCell: {
    fontSize: 8,
  },
  observacoesBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  observacoesTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  footer: {
    marginTop: 30,
    textAlign: 'center',
    color: '#666',
    fontSize: 8,
  },
});

const WorkoutPDF = ({ ficha }: { ficha: FichaTreino }) => {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(new Date(ficha.criadoEm));
  const geradoEm = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date());

  return (
    <Document title={`Ficha de Treino - ${ficha.membro.nome}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Gabi Studio</Text>
          <Text style={styles.subtitle}>Ficha de Treino</Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoCol}>
            <View style={styles.infoItem}>
              <Text><Text style={styles.infoLabel}>Aluno: </Text>{ficha.membro.nome}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text><Text style={styles.infoLabel}>Treino: </Text>{ficha.nome}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            <View style={styles.infoItem}>
              <Text><Text style={styles.infoLabel}>Objetivo: </Text>{ficha.objetivo || 'Não especificado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text><Text style={styles.infoLabel}>Data: </Text>{dataFormatada}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Exercício</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Grupo</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Séries</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Reps</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Carga</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Descanso</Text></View>
            <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>Obs</Text></View>
          </View>

          {ficha.exercicios.map((ex, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: '#f9fafb' } : {}]}>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.nome}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.grupoMuscular}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.series}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.repeticoes}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.carga || '-'}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{ex.descanso || '-'}</Text></View>
              <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{ex.observacoes || '-'}</Text></View>
            </View>
          ))}
        </View>

        {ficha.observacoes && (
          <View style={styles.observacoesBox}>
            <Text style={styles.observacoesTitle}>Observações Gerais:</Text>
            <Text>{ficha.observacoes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Gabi Studio - Seu estúdio de Pilates</Text>
          <Text>Gerado em {geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Gera o HTML da ficha de treino para fallback ou visualização rápida
 */
export function gerarHTMLFichaTreino(ficha: FichaTreino): string {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(new Date(ficha.criadoEm))
  
  const exerciciosHTML = ficha.exercicios
    .map(
      (ex, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${ex.nome}</td>
        <td>${ex.grupoMuscular}</td>
        <td>${ex.series}</td>
        <td>${ex.repeticoes}</td>
        <td>${ex.carga || '-'}</td>
        <td>${ex.descanso || '-'}</td>
        <td>${ex.observacoes || '-'}</td>
      </tr>
    `
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ficha de Treino - ${ficha.membro.nome}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #7c3aed; }
        .header h1 { color: #7c3aed; font-size: 24px; margin-bottom: 5px; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f3f4f6; border-radius: 8px; }
        .info-item { margin-bottom: 5px; }
        .info-label { font-weight: bold; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #7c3aed; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9fafb; }
        .observacoes { margin-top: 20px; padding: 10px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header"><h1>Gabi Studio</h1><p>Ficha de Treino</p></div>
      <div class="info">
        <div>
          <div class="info-item"><span class="info-label">Aluno:</span> ${ficha.membro.nome}</div>
          <div class="info-item"><span class="info-label">Treino:</span> ${ficha.nome}</div>
        </div>
        <div>
          <div class="info-item"><span class="info-label">Objetivo:</span> ${ficha.objetivo || 'Não especificado'}</div>
          <div class="info-item"><span class="info-label">Data:</span> ${dataFormatada}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Exercício</th><th>Grupo</th><th>Séries</th><th>Reps</th><th>Carga</th><th>Descanso</th><th>Obs</th></tr></thead>
        <tbody>${exerciciosHTML}</tbody>
      </table>
      ${ficha.observacoes ? `<div class="observacoes"><strong>Observações Gerais:</strong><p>${ficha.observacoes}</p></div>` : ''}
      <div class="footer"><p>Gabi Studio - Seu estúdio de Pilates</p><p>Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}</p></div>
    </body>
    </html>
  `
}

/**
 * Gera o buffer do PDF da ficha de treino
 */
export async function gerarPDFFichaTreino(ficha: FichaTreino): Promise<Buffer> {
  return await renderToBuffer(<WorkoutPDF ficha={ficha} />);
}
