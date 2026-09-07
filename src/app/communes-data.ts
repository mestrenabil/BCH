// الحدود الترابية الرسمية — الجريدة الرسمية للمملكة المغربية
// Official commune boundary data from the Moroccan Official Gazette (الجريدة الرسمية)
// Coordinate system: Lambert Conique Conforme Maroc Nord (EPSG:26191) → WGS84 (EPSG:4326)
// Communes:
//   - جماعة سلا: قرار وزير الداخلية رقم 1954.24 — الجريدة الرسمية عدد 7340
//   - جماعة سيدي أبي القنادل: جماعة ترابية (بوقنادل)
//   - جماعة عامر: جماعة قروية
//   - جماعة السهول: الحدود المستوردة من ملف KML المرفق
// السكان: الإحصاء العام للسكان والسكنى 2024 — المندوبية السامية للتخطيط (HCP)
// Population: RGPH 2024 — Haut Commissariat au Plan (HCP)

function decodePolyline(encoded: string): number[][] {
  const coordinates: number[][] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  const readValue = () => {
    let value = 0
    let shift = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      value |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    return value & 1 ? ~(value >> 1) : value >> 1
  }

  while (index < encoded.length) {
    latitude += readValue()
    longitude += readValue()
    coordinates.push([longitude / 1_000_000, latitude / 1_000_000])
  }

  return coordinates
}

const SEHOUL_BOUNDARY = decodePolyline("supi_Az_|yKpnB~y@xjAyYbp@oTtxLiDxYceCn_JkzBphDroBiUho@zP`jAbg@toBdg@pzC?fo@ub@hjBkLpuE{P~y@ymC`kFcg@`jAiUfzA{PxYqt@nd@g^d_@knHpvJo}@p_B}O~O]Zub@vb@ioAduCu|AlTcg@zYyYnd@_J|s@`EnXpp@nqAyPd_@iUjDoCd_@mCp_BjLduCkLpd@{PbeClLjzBjLlTnt@zYrk@d_@frC~y@vYxY?~FnC`GhUtjDtb@dzAmCp_BjLvdAvYvdA|Gj_A|GlTqt@rt@o}@`q@?pBsyEtjDzPvdAiUd_@kfAloAo}@pd@s_DhjBgiCv_CfoAjuDbp@vdAxjAd_@t|AhDt|AvIpnBnoAtb@zi@v|AfuCzG~y@mCfo@o}@p_BcaBrt@_y@nTcjB~tBkLjDk`CvdAap@j_Ak`C`jAu|AvIgrCxtAub@|i@u|Aj_AajBxYmwBcOyjAjD}aAuIadDhDq_De_@_y@?cg@yYqt@uIsb@tIap@e_@eaB{i@}rBwdAexAqd@kL?foA|_Dl}@beCmCtIiUvIcg@jDpk@pd@f^zi@xjAfuCvYloAyPlT}aAnTosG`OkfAd_@wYaOumC}_DexA_z@g^wIonBezAe^kDot@xYk`CnTwYtIkL~y@{{BxY_p@aOsvCsoBi`C{tAwYgo@wYyYot@wIkLmTub@cOsk@kDgUvIiUfo@iUbOm}@jDsmCe_@_\\dSuE~J}Gio@wYgo@wYytAwYe_@zPcOneByYbg@e_@tb@io@vYmoAlCk_AkLwdAyP_z@kLmTkL_z@iUqd@ifAakFlC}dBhU{i@xjAq_BzG}i@mC_z@e^qd@oCqd@|God@nt@ijBbaB}i@zaAjDbg@aOlCoTyPe_@cg@od@}GooAyPe_@sk@q_Bot@qzCyPytAoC}i@kLst@s|AjD{aAueFyPijB|Ge_@}GmT?mT|x@oTtmCajA|GwIwYw_CiUe_@jLmTiUe_@{GyYjL_z@{PujDhUk_Abg@cjAmCmTlCqd@mCqd@ot@ytAap@{i@kL?y{BloAg^xYaaB|i@g^?goAoTgU?ot@zYiUhDqk@pd@ot@nTiUkDkLtIyPiDusAauB{P{i@ifAcjAk}@w_CkLgo@ap@az@wYuIe^io@qeBst@_p@}i@oCaOqk@yYe^qd@}x@?ub@}i@e^aOimI|kKjLtoBtb@xoCjL~tB}GrzCccEwI}x@v_Cs|AduCh|GdpEqvCbjAibFbeCcg@}i@cxAtoBot@io@{G?isGxpHmpEqd@ccEduCy}EduCtsAtqMpk@fzAxlDxjElCvdAvY|dBxPzi@fUjD|GnT|GloAjLd_@jLloAlt@tt@bg@`jAcOe]kd@iF}x@hDgUzYiUrt@k}@|i@wYkDuY}i@{P_z@kLmTyP?yaAzi@{rB|dBifAd_@}x@?yaAqd@e`CbjAcg@kDwjAd_@knBmTiUtIgUnTwYrt@yPdzAyPd_@e^jzByPho@wYd_@sb@hDe^bOyaAbjAwYhD_p@uIusA`O_p@|i@kLmTok@az@ap@od@gfAkDag@`OwYho@}GlT?vdAuYloAxPpd@d^lTjLpd@zGnT{Gzi@}GbOyPjDsb@cOub@?yaAduCok@~y@}Gho@xPbjAmCd_@wYnd@mt@nTyrBoTyPjDyPbOkLxtAoCdzAhUxtA?d_@sb@vdAub@|i@nCd_@~o@pd@lCtIgUpd@?lTrb@j_AlCzY{G`OiUlTq|AxYyPnTag@|dBe^?{G{YlCmoA}GijBkLyYmC{i@uYwIyaAvIwYoTsb@{i@k}@qd@ag@}i@}GmTe^wIinBjDw{Bd_@ok@?qk@wIag@e_@wY{i@meBut@u{BgjBgfAe_@gUoTq|AmjCujA_z@axAcOe^qd@gU{i@{x@ut@_p@k_AinBmoAaxAw_Ce`Cw_CuYkDqk@yY}l@ebAl@qAag@iDk}@`O}o@go@owG}_DkqIsaMs}EovJkvCw_CkoFkzBewBj_Asb@lTe^vIwPlTe^`Oag@tt@gU`O{x@bOwaAjDkeBe_@c`CoTwaAmTgUmT}o@ujDi}@_pDyaAut@ivCepEqb@cjAkLuI}G`O}o@cjAnk@yjEiLwuFb^ujDkL_z@uY}i@yiBst@sb@st@wPio@}GwdA|GudA}GoTmCytAjLijB?k_AzGyYh}@_z@fUjDxPwIrb@iDvPhDjLaOfU}i@d^ytAzGk_AmCyYgUqd@zGmTyPqd@c^wIgUyY}`BeuC|o@pd@nCwI}GwIs{Bq_Bkt@st@ag@st@m|A{oC_p@soBkC{YwYgeD|o@qd@nCmTpb@qd@dfAmTtcDapD~hCaOt|FieDtYlT`g@_z@zx@|i@jt@oT{GezAb^?ok@ytAlt@e_@`g@xYb^yYvYwIkLtt@b^lTrb@e_@mCbjAyPdzArb@kDxzCst@vaAqd@rb@?pb@kDwPpd@iUd_@hUd_@rjAkD~o@mTjLnd@nk@c_@|`Bfo@jeBlTjLd_@`g@e_@zGyYjLnoAh}@rt@tYyYxaAlTtjAwIb^e_@vYk_A`g@iDyP`jAfUd_@{GztAfUxjEkLrt@lCho@pk@vIfUlTd^yYtYpd@~o@lT|o@|i@boAfo@iLpd@?d_@vaA}i@vYbOiUxtApk@xtArb@yYgU_z@nk@e_@tYwIj}@vzDfUjDjL_z@nk@|i@lCxYxaA?fU}i@ag@uI?oTujAmT}G}i@xPk_Aag@go@}`BwIlCwIsb@yYfUod@c^io@sb@aOlt@wIkLcjAok@uI|o@e_@mC}i@tY`OmCho@lt@p_BjLcOfUj_A~o@jDzx@st@zx@ijBzx@ajA~o@ooAqk@kzBnmC|i@pk@p_BvrB}dB?ljCzx@d_@n|AytAnC|_D|`BaO|Gw_Ch}@d_@fwBmuDgfAajAxmHceChUvIfUcOvYjDxPmT?oTzGuIxPtIlCbO~o@vIjLio@zGvIjLkDxPmT?oTag@k_A?aOj}@j_AfU~y@kLd_@lCfo@d^jDjLmT}Gqd@zP}dBxP??|i@hLd_@bg@d_@rb@cOjLod@fUd_@lt@kDxPyY{Gfo@qk@lTsb@pd@zGd_@ok@kDe^bOfUxYyPxtA|Gho@`g@zi@`g@nTnt@tdAb^vI|x@{i@rb@cjAmCwItYaOpk@io@yPztA}G~tBc^zi@`g@aOd^lTjLmTzGkuDrb@kzBsb@ezAjLqd@ffA{tAyPhjBrb@fo@|iB{dBxaAio@xPqd@rb@`z@rsArt@|x@ujDrb@yoCfUdzAe^heDyPpzCnt@jzBtjAooAxaAaeC~o@ut@tuDaeCpk@hDoCezA~o@j_AvY{i@bg@nd@zGst@vYjDfUgo@mCaz@qk@ytAlCst@e^io@nt@xYlC|i@j}@bjAlCyYbxA{tAmCyYd^?p|AezAhLqd@j}@?biCezAbg@wdAfUtoBfqD|_Dj}@io@?}uGnt@i{GhhDkDvYkpFvjA?ub@h`FbxAfo@pk@}i@mCvdAp|A~y@dzDvzDj}@a`E~o@|zElnBqd@|x@q_Brb@ytA?ieD}x@k_A?qd@nt@fo@rb@geDx{BauB|tEmTvqI|bTrmCxoC|x@go@?loAx{BbOj}@ut@zPm`GgoAujDrb@wdAnt@njC|x@ieDvdCmoAyP}i@fUcO|Gpd@n_DbOlCxYvYyY|G`OoCnTlnBzi@nt@ezAnnBe_@jL}_Dpk@jDd^~y@gUj_AxlD}i@~x@q_BoCj_AhUho@xjAst@zGqzC`p@tIub@neElhDxYpzO_uBtmCljCxPzjEclE|kKiUbeCxjAjDppE_uBdxA?vmCcOr{Hst@dxAujDzaAq_BvxFkuD|lDaaJj`CjDvsAvdAh`CpzChoAxtAxyV`aJxjAtoB~rBtdAtpEj_A~x@tt@")

// Verified Shoul ring from communes.kml (ISO MA-04-441-0111).
SEHOUL_BOUNDARY.splice(0, SEHOUL_BOUNDARY.length, ...decodePolyline("ogcq_AvydvKiU_z@yrBk_Aq|Apd@gUd_@mt@zi@ub@ho@nBxy@@D\\bO_p@wIe^e_@cg@?uYyYcxAfo@gfAhjBcg@pd@|Gnd@rb@bOfUxYmt@jDe^lTyPj_AkL`uBmCnd@e^dzAag@h{GgCbOIb@sYxcBfUpd@|iBloAoeBmT_p@d_@gUnd@omCmT}|FnjCwrB|dBwjA`Oqk@j_Ad^zjErb@?vY`O`g@aOiLnd@b^nTc^tIifA?gUj_A`g@hjBd^wIlC|i@{Gpd@tjApd@nCnd@rb@uI`g@pd@|x@oTrb@}dBbqDtoBhfAmTtjAxYj}@yY|x@lToeBfo@i}@aOot@jDujAxYmvCkDyPpd@nk@puEvYho@gU~tByP}i@sdCn{HoCnoArb@j_Ac^nd@ot@soBmeBv_CquDroBaiCjDrb@toBnk@dzAvjAooAd^kDwY`uBlt@oT`g@ho@d^kDpk@pd@`g@kDv{BytAlCd_@sb@rt@jLj_Ab^|dByPlTuYkDmt@q_Bsb@od@ghD?wYnd@yPztAvYj_AyPxY?fo@ub@d_@i}@d_@?|i@ssAjDyaAj_A{Gzi@k}@ztAsb@}i@meBvdAgUvdA~o@n_Bn|AnTxaAzi@h}@zjEymHbeCffA`jAgwBluDi}@e_@}Gv_C}`B`OoC}_Do|AxtA{x@e_@?mjCwrB|dBqk@q_BomC}i@pk@jzB_p@noA{x@`jA{x@hjB{x@rt@_p@kDgUk_AkLbOmt@q_BlCio@uYaOlC|i@}o@d_@nk@tIjLbjAmt@vIrb@`Ob^ho@gUnd@rb@xYmCvI|`BvI`g@fo@yPj_A|G|i@tjAlT?nT`g@tIgU|i@yaA?mCyYok@}i@kL~y@gUkDk}@wzDuYvIok@d_@fU~y@sb@xYqk@ytAhUytAwYcOwaA|i@?e_@hLqd@coAgo@}o@}i@_p@mTuYqd@e^xYgUmTqk@wImCio@jLst@gUyjEzG{tAgUe_@xPajAag@hDwYj_Ac^d_@ujAvIyaAmTuYxYi}@st@kLooA{GxYag@d_@kLe_@keBmT}`Bgo@ok@b_@kLod@_p@lTsjAjDiUe_@hUe_@vPqd@qb@jDsb@?waApd@yzCrt@sb@jDxPezAlCcjAsb@d_@c^mTjLut@wYvIc^xYag@yYmt@d_@nk@xtAc^?zGdzAkt@nT{x@}i@ag@~y@uYmTu|FheD_iC`OucD`pDefAlTqb@pd@oClT}o@pd@vYfeDk{RwwQs{BujD{GvIchDyuF}wAezAkfFepEcwByoCaaGguCsjAnTusFloAc_DujDag@aO?qd@koK{qNnCskI{bJclL{pDieDok@k_Ayx@j_Aok@puEwiBvbSgnGjDoeLa|Ke~DeoC?SgnG{jEosAmoAubJafIogSisQaDuCjLo`GvPelLhLclLhA?rEkuDlk@o{H_g@zi@qb@e_@}o@k_A{o@ajAuaAceCyPmTsYcOa_DqkImk@_z@qb@cOiLqd@oC{i@qb@}dBeeBkzBgUut@mCyY~f@od@pb@wItaA_z@~f@_z@fUcOvPojCuYezAuaAmT{wA}i@g}@vIqrBbjAit@}i@~f@q_Bd}@qd@n{BgjBfU?riBqd@jt@qd@|_Ce_@dUvI`wB}i@bfAw_CbfAk_AzwAst@b^qd@taA?xPlT|_Cj_A|rFiby@rxKt_N|_CduCtYbOxE?~IhDl\\iDpI?|UaE~XuCxm@oMpm@iK?eAzxEqbAlCcOxx@udAfU}i@b^e_@zGyYnk@e_@f}@cjAfU{i@hLk_Amk@ezAosAq_BgUcO{GmTllDk_AtsKypHosAo_BwiBcjAxaFcjAuY`uBmCfo@fU?b^lTb^vItY?nk@mTrrBlTj}E~y@xPkDxPe_@heBbOlk@cO`g@_z@tYajAfU`OhLxYb^aOfnByYheBhDzGajA`g@qd@mt@cjAboA{dBzGtItYmTfUvIjt@{YgUgo@c^kzB{GieDjt@st@fUut@f}@aeCtYijBxPeuCgUijBlCyYmCyYzGst@mCwdAiLyYpb@gzAlC{i@fUqd@pb@e_@jLqd@rjAyYjt@moAfU}dByx@wIok@e_@heBw_CfUgo@mC{tApb@e_@mCgo@l|AytAf}@ooAfnBk_AiL{dBok@{oCnsAwdAd^{i@?q_BlCio@tYmT`g@cOtY{i@nk@e_@hLqd@tYlTfUbjAboAhjBhLd_@mCnd@pb@d_@nk@xYtrBp_B|Gd_@tYvIb^j_AjmC_uB``Cqd@fnBlTl|Aqd@zqCe_@trBo_BvaAuoBhgE}i@xbEsoBrjAqd@hgEk_Arb@mTnk@j_AvaAjD~hCp_B`g@`jAnk@d_@baGuI~o@lTb^?boAst@d^?xP`OtYbOlt@loAtjAheDb^p_B{GljCjLho@pb@vdA`xArt@`g@fo@lC`z@leBxtA~wA|dBtjAtIlt@bjAxaApd@psAkDffAjzBag@dzAxPvdAzx@?zGio@jLyoCboA{jE|GyYjt@_z@d^soB?ceCok@ceCmCst@gwBq_B}`B_z@}qC}dB{x@st@uYk_AlCezAziBakFnuD}dBfUqd@{GudAd^e_@tqNqzCdeMypHnhI}_Drb@ovJp|Ak_AveGbjApk@wdAkLclLbbF}dBjaGjkHnmCmeEhU{`Ik}@ooAw{B?i_DvdAe`CaOag@}dBd^wzDnk@ooAxaA_z@|x@jDhnB}dB|iB}zEqk@a|KfUgwN~o@ieDdoAwdAjaGj_A~bEbOxtEueFv_IvIhhOmT|xKdpErsA|dByPxoCmCp_Bd^ho@rb@kDt^wYrf@mD~o@jDtsA~y@lt@jDhfAtdA|GtjDfUtjDhUloA|G`kFrb@pkImCjzBd^|dBfUfo@|G`z@iU`jAhUho@e^xYlCp_B}GroBmC|zE}zCh`F~|FlT`nHod@fUcjAlCwzDvdCxY|x@wdAf`CaObxAvIdzDloAd^d_@jfArt@hsGtjD~iBrt@jhDgo@peBhDzrBzYdxAjzBhfApuElhDfmRtsApzC|rBzeGrb@lTqk@v_Cu~DxuFaaB|_DkwBxoCm}@xtAm}@|i@ifAlTs|AkDusAd_@ot@|i@?j_AzlDtjDf`CxtAraGpuEsk@|i@alE|dBot@n_Bl}@hjBnt@rt@|x@iDrgEauBd^jzB|GfuCzaAp_BlCp_BkwB`eCcg@|dBsgEjpFwdC`uBiqDxtAmt@jDexA_z@eiCceC_p@cO_y@vI_p@noAot@j_AarCkDot@dzAiUxjEpk@fzAylDrjDarCp_Bcg@jD_{CezA{rBq_BuuDyYg`CxtAaaBbjA_p@ljCqk@fpEjLxeGot@rpGknBjfJgqDb`EusA~y@{cDvImeBhjBtYroBhU`kFkLpuEsb@ljCq|A`pDcg@dpEk}@ztAarCroBwjAqd@eoAc`EgUgjBq|A_z@qmChDyaAbjA}x@lTeoAjzBkL|_DvjA`uBbiCj_Ap`HwI|iBxtAxPpd@xPvI|x@puEwjAkDgU|i@knBjDiyEfo@oeBkDcmIvuFxP`kFvjAroBvjA?leBbjA|iBwdA|x@jD{rB|dB{x@`jAoCheDjLtt@hfA`OiU|i@sb@d_@fiFjnGz@dAyPxY_^yYqnBq_B"))

const COMMUNES_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {
        name: "جماعة سلا",
        nameFr: "Commune de Salé",
        nameEn: "Municipality of Salé",
        source: "قرار وزير الداخلية رقم 1954.24 — الجريدة الرسمية عدد 7340",
        sourceDecree: "قرار رقم 1954.24 صادر في 16 محرم 1446 (يوليو 2024)",
        sourceGazette: "الجريدة الرسمية عدد 7340",
        sourceProjection: "Lambert Conique Conforme Maroc Nord (EPSG:26191)",
        sourcePopulation: "المندوبية السامية للتخطيط — إحصاء 2024",
        color: "#059669",
        population: "945101",
        populationMunicipale: "938475",
        populationCompteeAPart: "6626",
        menages: "256144",
        codeHCP: "04.441.01.0",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [-6.780095,34.096834],  // النقطة 1
          [-6.775658,34.093862],  // النقطة 2
          [-6.774806,34.094818],  // النقطة 3
          [-6.767580,34.090298],  // النقطة 4
          [-6.768273,34.089578],  // النقطة 5 — طريق سيدي ابراهيم بولعجول (الإقليمية 4004)
          [-6.739585,34.070209],  // النقطة 6
          [-6.738076,34.070009],  // النقطة 7
          [-6.737991,34.070136],  // النقطة 8
          [-6.737784,34.070066],  // النقطة 9
          [-6.737890,34.069911],  // النقطة 10
          [-6.739729,34.064751],  // النقطة 11
          [-6.737883,34.063797],  // النقطة 12
          [-6.736234,34.060902],  // النقطة 13 — سور القاعدة الجوية
          [-6.735974,34.061590],  // النقطة 14
          [-6.732036,34.059891],  // النقطة 15
          [-6.730793,34.059363],  // النقطة 16
          [-6.729583,34.052495],  // النقطة 17
          [-6.724633,34.049770],  // النقطة 18
          [-6.726547,34.047423],  // النقطة 19
          [-6.723390,34.045679],  // النقطة 20
          [-6.726833,34.041341],  // النقطة 21
          [-6.732072,34.040312],  // النقطة 22
          [-6.730858,34.037466],  // النقطة 23
          [-6.731416,34.037090],  // النقطة 24 — نهاية سور القاعدة الجوية
          [-6.721011,34.028894],  // النقطة 25
          [-6.720026,34.031105],  // النقطة 26
          [-6.718445,34.033241],  // النقطة 27 — سور معهد موالي رشيد للرياضات
          [-6.716292,34.032019],  // النقطة 28
          [-6.716200,34.030261],  // النقطة 29
          [-6.717843,34.028576],  // النقطة 30
          [-6.720989,34.025341],  // النقطة 31
          [-6.719758,34.024867],  // النقطة 32
          [-6.702139,34.029461],  // النقطة 33 — الطريق الوطنية رقم 6
          [-6.690677,34.032240],  // النقطة 34
          [-6.720508,33.999354],  // النقطة 35
          [-6.719274,33.996571],  // النقطة 36
          [-6.702863,33.993929],  // النقطة 37
          [-6.715092,33.983493],  // النقطة 38
          [-6.720310,33.983465],  // النقطة 39
          [-6.728130,33.977313],  // النقطة 40
          [-6.732096,33.973357],  // النقطة 41
          [-6.730443,33.968612],  // النقطة 42
          [-6.755450,33.941712],  // النقطة 43
          [-6.751972,33.937240],  // النقطة 44
          [-6.752272,33.937011],  // النقطة 45
          [-6.758435,33.940173],  // النقطة 46
          [-6.759748,33.939771],  // النقطة 47
          [-6.760879,33.939425],  // النقطة 48
          [-6.794241,33.936136],  // النقطة 49 — الضفة اليمنى لنهر أبي الرقراق
          [-6.810531,34.005182],  // النقطة 50
          [-6.805900,34.018113],  // النقطة 51
          [-6.807072,34.019615],  // النقطة 52
          [-6.832030,34.030957],  // النقطة 53
          [-6.833045,34.030811],  // النقطة 54
          [-6.839064,34.038398],  // النقطة 55
          [-6.838283,34.039679],  // النقطة 56
          [-6.832986,34.039668],  // النقطة 57 — ساحل المحيط الأطلسي
          [-6.791394,34.082794],  // النقطة 58
          [-6.780095,34.096834],  // إغلاق المضلع (النقطة 1)
        ]]
      }
    },
    {
      type: "Feature" as const,
      properties: {
        name: "جماعة سيدي أبي القنادل",
        nameAr: "بوقنادل",
        nameFr: "Commune de Sidi Bouknadel",
        nameEn: "Municipality of Sidi Bouknadel",
        source: "الجريدة الرسمية",
        sourcePopulation: "المندوبية السامية للتخطيط — إحصاء 2024",
        color: "#7c3aed",
        population: "43598",
        populationMunicipale: "43550",
        populationCompteeAPart: "48",
        menages: "10439",
        codeHCP: "04.441.01.08",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [-6.719511,34.175484],
          [-6.712372,34.169806],
          [-6.705725,34.163544],
          [-6.725992,34.140245],
          [-6.704692,34.131676],
          [-6.710436,34.124952],
          [-6.714715,34.121110],
          [-6.693344,34.109500],
          [-6.692547,34.106965],
          [-6.692445,34.100149],
          [-6.693199,34.099059],
          [-6.704140,34.104293],
          [-6.710380,34.106185],
          [-6.725832,34.093523],
          [-6.737998,34.099391],
          [-6.729121,34.107999],
          [-6.732494,34.110209],
          [-6.736474,34.106731],
          [-6.745494,34.112316],
          [-6.746670,34.111221],
          [-6.747427,34.111844],
          [-6.745107,34.114611],
          [-6.758460,34.121961],
          [-6.719511,34.175484],
        ]]
      }
    },
    {
      type: "Feature" as const,
      properties: {
        name: "جماعة عامر",
        nameFr: "Commune rurale d'Ameur",
        nameEn: "Rural Municipality of Ameur",
        source: "الجريدة الرسمية",
        sourcePopulation: "المندوبية السامية للتخطيط — إحصاء 2024",
        color: "#d97706",
        population: "75942",
        populationMunicipale: "75896",
        populationCompteeAPart: "46",
        menages: "18540",
        codeHCP: "04.441.01.13",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [-6.705725,34.163544],
          [-6.698631,34.158577],
          [-6.690391,34.153720],
          [-6.688765,34.155261],
          [-6.687088,34.159976],
          [-6.683327,34.161629],
          [-6.632536,34.125074],
          [-6.632457,34.124109],
          [-6.630924,34.124602],
          [-6.575326,34.124414],
          [-6.580745,34.117870],
          [-6.567051,34.110658],
          [-6.558051,34.104888],
          [-6.551604,34.065087],
          [-6.601625,34.022826],
          [-6.627763,34.026072],
          [-6.630222,34.030711],
          [-6.630835,34.033464],
          [-6.633962,34.033993],
          [-6.637407,34.043122],
          [-6.638656,34.044850],
          [-6.640272,34.044987],
          [-6.639471,34.041992],
          [-6.640730,34.044432],
          [-6.640570,34.039303],
          [-6.639445,34.040179],
          [-6.644064,34.038943],
          [-6.645966,34.040115],
          [-6.647790,34.041909],
          [-6.648743,34.041900],
          [-6.650415,34.039908],
          [-6.652116,34.039891],
          [-6.653809,34.039324],
          [-6.655856,34.037094],
          [-6.664807,34.034317],
          [-6.665405,34.031515],
          [-6.690677,34.032240],
          [-6.702139,34.029461],
          [-6.719765,34.025354],
          [-6.720982,34.024854],
          [-6.716175,34.028593],
          [-6.717868,34.030244],
          [-6.718445,34.033241],
          [-6.716292,34.032019],
          [-6.721011,34.028894],
          [-6.720026,34.031105],
          [-6.731416,34.037090],
          [-6.730858,34.037466],
          [-6.732072,34.040312],
          [-6.726833,34.041341],
          [-6.723390,34.045679],
          [-6.726547,34.047423],
          [-6.724633,34.049770],
          [-6.729583,34.052495],
          [-6.730793,34.059363],
          [-6.732036,34.059891],
          [-6.736234,34.060902],
          [-6.735974,34.061590],
          [-6.737883,34.063797],
          [-6.739729,34.064751],
          [-6.737890,34.069911],
          [-6.737784,34.070066],
          [-6.737991,34.070136],
          [-6.738076,34.070009],
          [-6.739585,34.070209],
          [-6.768273,34.089578],
          [-6.767580,34.090298],
          [-6.774806,34.094818],
          [-6.775658,34.093862],
          [-6.780095,34.096834],
          [-6.758460,34.121961],
          [-6.745107,34.114611],
          [-6.747427,34.111844],
          [-6.746670,34.111221],
          [-6.745494,34.112316],
          [-6.736474,34.106731],
          [-6.732494,34.110209],
          [-6.729121,34.107999],
          [-6.737998,34.099391],
          [-6.725832,34.093523],
          [-6.710380,34.106185],
          [-6.704140,34.104293],
          [-6.693199,34.099059],
          [-6.692445,34.100149],
          [-6.692547,34.106965],
          [-6.693344,34.109500],
          [-6.714715,34.121110],
          [-6.710436,34.124952],
          [-6.704692,34.131676],
          [-6.725992,34.140245],
          [-6.705725,34.163544],
        ]]
      }
    },
    {
      type: "Feature" as const,
      properties: {
        name: "جماعة السهول",
        nameAr: "السهول",
        nameFr: "Commune de Shoul",
        nameEn: "Municipality of Shoul",
        source: "ملف communes.kml — Shoul",
        sourceCode: "MA-04-441-0111",
        sourceProjection: "WGS84 (EPSG:4326)",
        sourcePopulation: "ملف communes.kml",
        color: "#0ea5e9",
        population: "22281",
        populationCompteeAPart: "50",
        menages: "5188",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [SEHOUL_BOUNDARY],
      }
    }
  ]
}

export default COMMUNES_GEOJSON
