import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define the "Cute Theme" styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#fff1f2', // pink-50
  },
  // --- COVER PAGE ---
  coverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    border: '4px dashed #f9a8d4', // pink-300
    margin: 10,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  coverTitle: {
    fontSize: 40,
    fontFamily: 'Times-Roman',
    color: '#db2777', // pink-600
    marginBottom: 20,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#94a3b8', // slate-400
    marginBottom: 10,
    fontStyle: 'italic',
  },
  coverCount: {
    fontSize: 14,
    color: '#f472b6', // pink-400
    marginTop: 20,
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },

  // --- TABLE OF CONTENTS ---
  tocTitle: {
    fontSize: 24,
    fontFamily: 'Times-Roman',
    color: '#db2777',
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '2px solid #fbcfe8',
    paddingBottom: 10,
  },
  tocItem: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 10,
    flexDirection: 'row',
    borderBottom: '1px dashed #e2e8f0',
    paddingBottom: 5,
  },

  // --- RECIPE PAGES ---
  recipePage: {
    padding: 30,
    backgroundColor: 'white',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #fce7f3', // pink-100
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Times-Roman',
    color: '#be185d', // pink-700
    marginBottom: 10,
  },
  description: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#475569', // slate-600
    backgroundColor: '#fffbeb', // yellow-50
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 1.5,
    borderLeft: '4px solid #fde047',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#ec4899', // pink-500
    marginTop: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  ingredientItem: {
    fontSize: 12,
    color: '#334155', // slate-700
    marginBottom: 6,
    marginLeft: 10,
  },
  instructionItem: {
    fontSize: 12,
    color: '#334155', // slate-700
    marginBottom: 12,
    lineHeight: 1.6,
  },
  stepNumber: {
    color: '#f472b6', // pink-400
    fontWeight: 'bold',
    marginRight: 5,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#cbd5e1',
  },
});

interface RecipePDFProps {
  recipes: any[];
}

export const RecipeBookletPDF = ({ recipes }: RecipePDFProps) => (
  <Document>
    {/* --- PAGE 1: COVER --- */}
    <Page size="A4" style={styles.page}>
      <View style={styles.coverContainer}>
        <Text style={styles.coverTitle}>My Recipe Journal</Text>
        <Text style={styles.coverSubtitle}>A Collection of Kitchen Memories</Text>
        <Text style={styles.coverCount}>
          Contains {recipes.length} {recipes.length === 1 ? 'Recipe' : 'Recipes'}
        </Text>
      </View>
    </Page>

    {/* --- PAGE 2: TABLE OF CONTENTS --- */}
    <Page size="A4" style={styles.recipePage}>
      <Text style={styles.tocTitle}>Table of Contents</Text>
      {recipes.map((recipe, index) => (
        <Text key={recipe.id} style={styles.tocItem}>
          {index + 1}. {recipe.title || "Untitled Recipe"}
        </Text>
      ))}
    </Page>

    {/* --- PAGE 3+: RECIPES (Loop through the list) --- */}
    {recipes.map((recipe, index) => (
      <Page key={recipe.id} size="A4" style={styles.recipePage}>
        <View style={styles.header}>
          <Text style={styles.title}>{recipe.title || "Untitled Recipe"}</Text>
        </View>

        {recipe.description && (
          <Text style={styles.description}>{recipe.description}</Text>
        )}

        <View>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients?.map((ing: string, i: number) => (
            <Text key={i} style={styles.ingredientItem}>• {ing}</Text>
          ))}
        </View>

        <View>
          <Text style={styles.sectionTitle}>Preparation</Text>
          {recipe.instructions?.map((inst: string, i: number) => (
            <Text key={i} style={styles.instructionItem}>
               <Text style={styles.stepNumber}>{i + 1}. </Text> 
               {inst}
            </Text>
          ))}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>
    ))}
  </Document>
);