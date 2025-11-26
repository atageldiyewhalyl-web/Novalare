import { motion } from "motion/react";
import { CheckCircle, Mail, Table, MessageSquare, Bell, FileText } from "lucide-react";
import { Button } from "./ui/button";

interface InvoiceData {
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
  currency: string;
}

interface InvoiceAnimationStagesProps {
  data: InvoiceData;
  onReset: () => void;
}

export function InvoiceAnimationStages({ data, onReset }: InvoiceAnimationStagesProps) {
  const dataFields = [
    { label: 'Supplier Name', value: data.supplier_name, icon: FileText },
    { label: 'Invoice Number', value: data.invoice_number, icon: FileText },
    { label: 'Invoice Date', value: data.invoice_date, icon: FileText },
    { label: 'Due Date', value: data.due_date, icon: FileText },
    { label: 'Net Amount', value: `${data.currency} ${data.net_amount}`, icon: FileText },
    { label: 'VAT Amount', value: `${data.currency} ${data.vat_amount}`, icon: FileText },
    { label: 'Total Amount', value: `${data.currency} ${data.total_amount}`, icon: FileText, highlight: true },
  ];

  const workflowSteps = [
    { 
      label: 'Email Received', 
      description: 'Invoice arrives in your inbox',
      icon: Mail,
      delay: 0
    },
    { 
      label: 'Extracted', 
      description: 'Data captured in 2 seconds',
      icon: CheckCircle,
      delay: 0.6
    },
    { 
      label: 'Validated', 
      description: 'Missing info? Auto-email sent to client',
      icon: Mail,
      delay: 1.2
    },
    { 
      label: 'Recorded', 
      description: 'Added to your Excel/Google Sheets',
      icon: Table,
      delay: 1.8
    },
    { 
      label: 'Confirmed', 
      description: 'Confirmation email sent to client',
      icon: MessageSquare,
      delay: 2.4
    },
    { 
      label: 'Notified', 
      description: 'Your team gets a Slack notification',
      icon: Bell,
      delay: 3.0
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stage 1: Data Extraction Reveal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
          </div>
          <h3 className="text-xl sm:text-3xl text-white mb-2">Here's What We Extracted</h3>
          <p className="text-purple-200 text-sm sm:text-base">
            AI successfully extracted all invoice data
          </p>
        </motion.div>

        <div className="space-y-2 sm:space-y-3">
          {dataFields.map((field, index) => (
            <motion.div
              key={field.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-2 ${
                field.highlight
                  ? 'bg-gradient-to-r from-purple-500/20 via-fuchsia-500/20 to-pink-500/20 border-purple-500/50'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  field.highlight ? 'bg-purple-500/30' : 'bg-white/10'
                }`}>
                  <field.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    field.highlight ? 'text-purple-300' : 'text-purple-200'
                  }`} />
                </div>
                <span className="text-purple-200 text-sm sm:text-base truncate">{field.label}</span>
              </div>
              <span className={`text-sm sm:text-base flex-shrink-0 ${field.highlight ? 'text-white font-bold' : 'text-white/90'}`}>
                {field.value}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stage 2: "Imagine This..." Context */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 sm:space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-8 sm:py-12"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6 sm:mb-8 px-4"
          >
            <h3 className="text-xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent mb-3 sm:mb-4">
              Now Imagine This Happening Automatically...
            </h3>
            <p className="text-base sm:text-xl text-purple-200">
              Every time a client sends an invoice to your inbox
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-3 sm:gap-4 p-5 sm:p-8 bg-white/5 border border-white/10 rounded-2xl mx-4"
          >
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1.1, 1.1, 1]
              }}
              transition={{ 
                delay: 1.2,
                duration: 0.6,
                ease: "easeInOut"
              }}
              className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-purple-300" />
            </motion.div>
            <div className="text-left">
              <div className="text-white text-sm sm:text-base mb-1">New Email Received</div>
              <div className="text-purple-200/70 text-xs sm:text-sm">invoice_Q4_2025.pdf</div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Stage 3: Full Workflow Automation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 sm:space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6 sm:mb-8"
        >
          <h3 className="text-xl sm:text-3xl text-white mb-2">Here's What Happens Next</h3>
          <p className="text-purple-200 text-sm sm:text-base">
            Complete automation in action
          </p>
        </motion.div>

        <div className="space-y-3 sm:space-y-4">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay }}
              className="relative"
            >
              <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: step.delay + 0.2, type: "spring", stiffness: 300 }}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0"
                >
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm sm:text-base">{step.label}</span>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: step.delay + 0.3 }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                    </motion.div>
                  </div>
                  <p className="text-purple-200/70 text-xs sm:text-sm">{step.description}</p>
                </div>
              </div>
              
              {/* Connecting line */}
              {index < workflowSteps.length - 1 && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 16 }}
                  transition={{ delay: step.delay + 0.4, duration: 0.3 }}
                  className="w-0.5 bg-gradient-to-b from-green-500/50 to-purple-500/50 ml-5 sm:ml-6 my-1"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Success Message & Reset */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.5 }}
          className="text-center pt-6 sm:pt-8 space-y-3 sm:space-y-4"
        >
          <div className="text-xl sm:text-2xl text-white mb-2">
            ✨ All done in <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">2 seconds</span>
          </div>
          <p className="text-purple-200 text-sm sm:text-base mb-4 sm:mb-6">
            This is the power of automated invoice processing
          </p>
          <Button
            onClick={onReset}
            className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-600 text-white px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
          >
            Try Another Invoice
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}