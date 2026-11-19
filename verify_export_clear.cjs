const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(process.argv[2]||'.'),moduleResult={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/app/app.component.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
new Function('require','module','exports',code)(name=>name==='@angular/core'?{Component:()=>x=>x,HostListener:()=>()=>{}}:{},moduleResult,moduleResult.exports);
const {AppComponent}=moduleResult.exports;
for(const fails of [false,true]){
 let exported;
 const app=new AppComponent({},{},{computeDuplicates:()=>[]},{exportExcel:rows=>{if(fails)throw Error('Falha simulada');exported=rows.map(row=>({...row}));return {filename:'teste.xlsx',rowsCount:rows.length};}});
 const rows=[{'TÍTULO':'TESTE_1'},{'TÍTULO':'TESTE_2'}];
 app.rows=rows;app.searchTerm='TESTE';app.activeFilter='partidas';app.showToast=()=>{};
 app.monthlyReport={id:'relatorio-preservado'};
 app.exportExcel();
 if(fails){assert.equal(app.rows,rows);assert.equal(app.searchTerm,'TESTE');assert.equal(app.activeFilter,'partidas');}
 else{assert.deepEqual(exported,rows);assert.deepEqual(app.rows,[]);assert.deepEqual(app.duplicates,[]);assert.equal(app.searchTerm,'');assert.equal(app.activeFilter,'all');}
 assert.equal(app.monthlyReport.id,'relatorio-preservado');
}
console.log('OK: exportação recebe o lote inteiro; sucesso limpa malhas e filtros; erro preserva os dados; relatório mensal permanece carregado.');
