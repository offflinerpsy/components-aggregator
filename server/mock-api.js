const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());

function page(items, page=1, pageSize=20){
  const total = items.length;
  const start = (page-1)*pageSize;
  return { items: items.slice(start, start+pageSize), total, page, pageSize };
}

app.get("/api/search", (req,res)=>{
  const q = (req.query.q||"").toString().toLowerCase();
  const pageN = parseInt(req.query.page||"1",10);
  const ps = parseInt(req.query.pageSize||"20",10);
  // демо-данные
  const data = [
    { mpn:"2N3904", description:"NPN transistor, 200mA", availability:{inStock:1200}, pricing:[{qty:1,price:0.05,currency:"USD"}], package:"TO-92", packaging:"Tape", url:"#", suppliers:[{name:"LCSC",url:"#"}] },
    { mpn:"2N2222", description:"NPN general purpose transistor", availability:{inStock:540}, pricing:[{qty:1,price:0.07,currency:"USD"}], package:"TO-92", packaging:"Bulk", url:"#", suppliers:[{name:"TME",url:"#"}] },
    { mpn:"BC547", description:"Low noise transistor", availability:{inStock:3000}, pricing:[{qty:1,price:0.03,currency:"USD"}], package:"TO-92", packaging:"Tape", url:"#", suppliers:[{name:"Farnell",url:"#"}] }
  ];
  const filtered = q ? data.filter(i =>
    i.mpn.toLowerCase().includes(q) || (i.description||"").toLowerCase().includes(q)
  ) : data;
  res.json(page(filtered, pageN, ps));
});

app.get("/api/products/:mpn",(req,res)=>{
  // примитив: отдаём один из data
  const mpn = req.params.mpn.toUpperCase();
  const base = {
    images:["/placeholder-1.png","/placeholder-2.png"],
    datasheets:["/placeholder.pdf"],
    technical_specs:{"Manufacturer":"DEMO","Voltage":"40V","Current":"200mA"}
  };
  const items = {
    "2N3904": { mpn:"2N3904", description:"NPN transistor, 200mA", availability:{inStock:1200}, pricing:[{qty:1,price:0.05,currency:"USD"}], package:"TO-92", packaging:"Tape", url:"#", suppliers:[{name:"LCSC",url:"#"}], ...base },
    "2N2222": { mpn:"2N2222", description:"NPN general purpose transistor", availability:{inStock:540}, pricing:[{qty:1,price:0.07,currency:"USD"}], package:"TO-92", packaging:"Bulk", url:"#", suppliers:[{name:"TME",url:"#"}], ...base },
    "BC547":  { mpn:"BC547",  description:"Low noise transistor", availability:{inStock:3000}, pricing:[{qty:1,price:0.03,currency:"USD"}], package:"TO-92", packaging:"Tape", url:"#", suppliers:[{name:"Farnell",url:"#"}], ...base }
  };
  res.json(items[mpn]||{});
});

app.listen(3000, ()=> console.log("Mock API on http://127.0.0.1:3000"));
