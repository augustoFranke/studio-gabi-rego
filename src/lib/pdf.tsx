import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

/**
 * PDF Generator for Training Plans
 * Replaces the previous Python/ReportLab implementation
 */

// Register fonts if needed. using standard Helvetica for now which is built-in.
// If we wanted the "handwritten" style, we'd need to register a font file here.

interface Exercicio {
  nome: string
  sessao?: string // A, B, C...
  grupoMuscular?: string | null
  series: string
  repeticoes: string
  descanso?: string | null
  observacoes?: string | null
}

interface FichaTreino {
  nome?: string
  data?: string | null
  objetivo?: string | null
  observacoes?: string | null
  exercicios: Exercicio[]
  membro: {
    nome: string
  }
}

// A4 dimensions in points (approximate)
// A4 is 595.28 x 841.89 points
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
  },
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginRight: 20,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerLine: {
    flexDirection: 'row',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 60,
  },
  headerValue: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'Helvetica', // Regular
  },
  sessionContainer: {
    marginBottom: 20,
    breakInside: 'avoid',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
    backgroundColor: '#f3f4f6',
    padding: 5,
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#e5e7eb',
    fontWeight: 'bold',
  },
  colExercise: {
    width: '45%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    justifyContent: 'center',
  },
  colSets: {
    width: '15%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    textAlign: 'center',
    justifyContent: 'center',
  },
  colReps: {
    width: '15%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    textAlign: 'center',
    justifyContent: 'center',
  },
  colNotes: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 10,
  },
  obsContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 10,
  },
  obsLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  obsText: {
    fontSize: 10,
  },
});

const WorkoutPDF = ({ ficha, logoPath }: { ficha: FichaTreino, logoPath?: string }) => {
  // Group exercises by session
  const sessionsMap = new Map<string, Exercicio[]>();
  
  // Sort exercises first to ensure order
  const sortedExercises = [...ficha.exercicios]; // Assuming they are already sorted by DB or caller

  sortedExercises.forEach(ex => {
    const sessionName = ex.sessao || 'A';
    const list = sessionsMap.get(sessionName) || [];
    list.push(ex);
    sessionsMap.set(sessionName, list);
  });

  // Sort session names (A, B, C...)
  const sortedSessionNames = Array.from(sessionsMap.keys()).sort();

  // Load logo
  // Note: In Vercel/Next.js, reading files at runtime can be tricky with paths.
  // We expect logoPath to be absolute.

  return (
    <Document title={`Ficha de Treino - ${ficha.membro.nome}`}>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          {logoPath && (
             // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoPath} style={styles.logo} />
          )}
          
          <View style={styles.headerInfo}>
            <View style={styles.headerLine}>
              <Text style={styles.headerLabel}>ALUNO:</Text>
              <Text style={styles.headerValue}>{ficha.membro.nome}</Text>
            </View>
            <View style={styles.headerLine}>
              <Text style={styles.headerLabel}>DATA:</Text>
              <Text style={styles.headerValue}>{ficha.data || new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</Text>
            </View>
          </View>
        </View>

        {/* Sessions */}
        {sortedSessionNames.map((sessionName) => {
          const exercises = sessionsMap.get(sessionName) || [];
          
          return (
            <View key={sessionName} style={styles.sessionContainer} wrap={false}>
              <Text style={styles.sessionTitle}>TREINO {sessionName}</Text>
              
              <View style={styles.table}>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <View style={styles.colExercise}><Text style={styles.cellText}>EXERCÍCIOS</Text></View>
                  <View style={styles.colSets}><Text style={styles.cellText}>SÉRIES</Text></View>
                  <View style={styles.colReps}><Text style={styles.cellText}>REPETIÇÕES</Text></View>
                  <View style={styles.colNotes}><Text style={styles.cellText}>OBS</Text></View>
                </View>

                {/* Rows */}
                {exercises.map((ex, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <View style={styles.colExercise}><Text style={styles.cellText}>{ex.nome}</Text></View>
                    <View style={styles.colSets}><Text style={styles.cellText}>{ex.series}</Text></View>
                    <View style={styles.colReps}><Text style={styles.cellText}>{ex.repeticoes}</Text></View>
                    <View style={styles.colNotes}><Text style={styles.cellText}>{ex.observacoes || ''}</Text></View>
                  </View>
                ))}
                
                {/* Empty rows for manual notes (optional, matching previous style) */}
                {[1, 2].map((_, idx) => (
                   <View key={`empty-${idx}`} style={styles.tableRow}>
                   <View style={styles.colExercise}><Text style={styles.cellText}></Text></View>
                   <View style={styles.colSets}><Text style={styles.cellText}></Text></View>
                   <View style={styles.colReps}><Text style={styles.cellText}></Text></View>
                   <View style={styles.colNotes}><Text style={styles.cellText}></Text></View>
                 </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* Observations */}
        {ficha.observacoes && (
          <View style={styles.obsContainer}>
            <Text style={styles.obsLabel}>OBSERVAÇÕES:</Text>
            <Text style={styles.obsText}>{ficha.observacoes}</Text>
          </View>
        )}

      </Page>
    </Document>
  );
};

/**
 * Generate PDF buffer for Training Plan
 */
export async function gerarPDFFichaTreino(ficha: FichaTreino): Promise<Buffer> {
  // Resolve logo path
  const logoPath = path.join(process.cwd(), 'public', 'logo-black.png');
  
  // Check if logo exists, otherwise pass undefined
  let logoExists = false;
  try {
    await fs.promises.access(logoPath);
    logoExists = true;
  } catch (e) {
    console.warn('Logo not found at', logoPath);
  }

  return await renderToBuffer(<WorkoutPDF ficha={ficha} logoPath={logoExists ? logoPath : undefined} />);
}